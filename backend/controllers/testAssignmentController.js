const db = require('../config/database');
const logger = require('../utils/logger');

// Assign test to candidate(s)
const assignTest = async (req, res) => {
  try {
    const companyId = req.companyId || req.user.company_id;
    const { test_id, candidate_ids, due_date, notes } = req.body;

    if (!test_id || !candidate_ids || !Array.isArray(candidate_ids) || candidate_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Test ID and candidate IDs are required'
      });
    }

    // Verify test exists and belongs to company
    const [tests] = await db.pool.execute(
      'SELECT id FROM tests WHERE id = ? AND company_id = ?',
      [test_id, companyId]
    );

    if (tests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    // Verify all candidates exist and belong to company
    const placeholders = candidate_ids.map(() => '?').join(',');
    const [candidates] = await db.pool.execute(
      `SELECT id FROM candidates WHERE id IN (${placeholders}) AND company_id = ?`,
      [...candidate_ids, companyId]
    );

    if (candidates.length !== candidate_ids.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more candidates not found or do not belong to your company'
      });
    }

    // Assign test to each candidate
    const assignments = [];
    const errors = [];

    for (const candidateId of candidate_ids) {
      try {
        // Check if already assigned
        const [existing] = await db.pool.execute(
          'SELECT id FROM test_assignments WHERE test_id = ? AND candidate_id = ?',
          [test_id, candidateId]
        );

        if (existing.length > 0) {
          // Update existing assignment
          await db.pool.execute(
            `UPDATE test_assignments 
             SET due_date = ?, notes = ?, status = 'assigned', assigned_at = CURRENT_TIMESTAMP
             WHERE test_id = ? AND candidate_id = ?`,
            [due_date || null, notes || null, test_id, candidateId]
          );
          assignments.push({ candidate_id: candidateId, action: 'updated' });
        } else {
          // Create new assignment
          const [result] = await db.pool.execute(
            `INSERT INTO test_assignments (test_id, candidate_id, assigned_by, due_date, notes)
             VALUES (?, ?, ?, ?, ?)`,
            [test_id, candidateId, req.user.id, due_date || null, notes || null]
          );
          assignments.push({ candidate_id: candidateId, action: 'created', assignment_id: result.insertId });
        }
      } catch (error) {
        errors.push({ candidate_id: candidateId, error: error.message });
        logger.error(`Error assigning test to candidate ${candidateId}:`, error);
      }
    }

    logger.info(`Test ${test_id} assigned to ${assignments.length} candidates by user ${req.user.id}`);

    res.json({
      success: true,
      message: `Test assigned to ${assignments.length} candidate(s)`,
      data: {
        assignments,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    logger.error('Assign test error:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning test',
      error: error.message
    });
  }
};

// Get assignments for a candidate
const getCandidateAssignments = async (req, res) => {
  try {
    const candidateId = req.params.candidateId || req.candidate?.id;
    const companyId = req.companyId || req.user?.company_id || req.candidate?.company_id;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID is required'
      });
    }

    const assignments = await db.query(
      `SELECT ta.*, 
              t.title, t.description, t.duration_minutes, t.status as test_status,
              COUNT(DISTINCT tq.question_id) as question_count,
              COUNT(DISTINCT test_attempts.id) as attempt_count
       FROM test_assignments ta
       INNER JOIN tests t ON ta.test_id = t.id
       LEFT JOIN test_questions tq ON t.id = tq.test_id
       LEFT JOIN test_attempts ON t.id = test_attempts.test_id AND test_attempts.candidate_id = ta.candidate_id
       WHERE ta.candidate_id = ? AND t.company_id = ?
       GROUP BY ta.id
       ORDER BY ta.assigned_at DESC`,
      [candidateId, companyId]
    );

    // Add status based on attempts and due date
    const assignmentsWithStatus = assignments.map(assignment => {
      const canAttempt = assignment.attempt_count < (assignment.max_attempts || 1);
      const isExpired = assignment.due_date && new Date(assignment.due_date) < new Date();
      
      let status = assignment.status;
      if (isExpired && status !== 'completed') {
        status = 'expired';
      } else if (assignment.attempt_count > 0 && status === 'assigned') {
        status = 'in_progress';
      }

      return {
        ...assignment,
        can_attempt: canAttempt && !isExpired,
        remaining_attempts: Math.max(0, (assignment.max_attempts || 1) - assignment.attempt_count),
        is_expired: isExpired
      };
    });

    res.json({
      success: true,
      data: assignmentsWithStatus
    });
  } catch (error) {
    logger.error('Get candidate assignments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching assignments',
      error: error.message
    });
  }
};

// Get assignments for a test
const getTestAssignments = async (req, res) => {
  try {
    const { testId } = req.params;
    const companyId = req.companyId || req.user.company_id;

    const assignments = await db.query(
      `SELECT ta.*, 
              c.id as candidate_id, c.email, c.first_name, c.last_name, c.phone,
              u.first_name as assigned_by_name, u.last_name as assigned_by_last_name,
              COUNT(DISTINCT test_attempts.id) as attempt_count
       FROM test_assignments ta
       INNER JOIN candidates c ON ta.candidate_id = c.id
       LEFT JOIN users u ON ta.assigned_by = u.id
       LEFT JOIN test_attempts ON ta.test_id = test_attempts.test_id AND ta.candidate_id = test_attempts.candidate_id
       WHERE ta.test_id = ? AND c.company_id = ?
       GROUP BY ta.id
       ORDER BY ta.assigned_at DESC`,
      [testId, companyId]
    );

    res.json({
      success: true,
      data: assignments
    });
  } catch (error) {
    logger.error('Get test assignments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching test assignments',
      error: error.message
    });
  }
};

// Remove test assignment
const removeAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const companyId = req.companyId || req.user.company_id;

    // Verify assignment exists and belongs to company
    const [assignments] = await db.pool.execute(
      `SELECT ta.id FROM test_assignments ta
       INNER JOIN tests t ON ta.test_id = t.id
       WHERE ta.id = ? AND t.company_id = ?`,
      [assignmentId, companyId]
    );

    if (assignments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    await db.pool.execute(
      'DELETE FROM test_assignments WHERE id = ?',
      [assignmentId]
    );

    logger.info(`Test assignment ${assignmentId} removed by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Assignment removed successfully'
    });
  } catch (error) {
    logger.error('Remove assignment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing assignment',
      error: error.message
    });
  }
};

module.exports = {
  assignTest,
  getCandidateAssignments,
  getTestAssignments,
  removeAssignment
};


const db = require('../config/database');
const logger = require('../utils/logger');

// Get all tests for a company
const getTests = async (req, res) => {
  try {
    const companyId = req.companyId || req.user.company_id;
    const { status, search } = req.query;

    let query = `
      SELECT t.*, u.first_name as created_by_name, u.last_name as created_by_last_name,
             COUNT(DISTINCT tq.question_id) as question_count
      FROM tests t
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN test_questions tq ON t.id = tq.test_id
      WHERE t.company_id = ?
    `;
    const params = [companyId];

    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (t.title LIKE ? OR t.description LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ' GROUP BY t.id ORDER BY t.created_at DESC';

    const tests = await db.query(query, params);

    res.json({
      success: true,
      data: tests
    });
  } catch (error) {
    logger.error('Get tests error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tests',
      error: error.message
    });
  }
};

// Get single test
const getTest = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId || req.user?.company_id || req.candidate?.company_id;

    const [tests] = await db.pool.execute(
      `SELECT t.*, u.first_name as created_by_name, u.last_name as created_by_last_name
       FROM tests t
       LEFT JOIN users u ON t.created_by = u.id
       WHERE t.id = ? AND t.company_id = ?`,
      [id, companyId]
    );

    if (tests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    // Get test categories
    const categories = await db.query(
      `SELECT tc.*, tcm.weight
       FROM test_categories_mapping tcm
       JOIN test_categories tc ON tcm.category_id = tc.id
       WHERE tcm.test_id = ?`,
      [id]
    );

    // Get test questions
    const questions = await db.query(
      `SELECT q.*, tq.display_order
       FROM test_questions tq
       JOIN questions q ON tq.question_id = q.id
       WHERE tq.test_id = ?
       ORDER BY tq.display_order ASC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...tests[0],
        categories,
        questions
      }
    });
  } catch (error) {
    logger.error('Get test error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching test',
      error: error.message
    });
  }
};

// Create test
const createTest = async (req, res) => {
  try {
    const companyId = req.companyId || req.user.company_id;
    const {
      title,
      description,
      instructions,
      duration_minutes,
      passing_score,
      max_attempts,
      negative_marking,
      negative_mark_percentage,
      enable_percentile,
      enable_ai_interpretation,
      enable_benchmark,
      enable_shortlist,
      status,
      settings,
      category_ids
    } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }

    // Start transaction
    const result = await db.transaction(async (connection) => {
      // Create test
      const [testResult] = await connection.execute(
        `INSERT INTO tests 
         (company_id, title, description, instructions, duration_minutes, passing_score,
          max_attempts, negative_marking, negative_mark_percentage, enable_percentile,
          enable_ai_interpretation, enable_benchmark, enable_shortlist, status, settings, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          companyId,
          title,
          description || null,
          instructions || null,
          duration_minutes || null,
          passing_score || null,
          max_attempts || 1,
          negative_marking || false,
          negative_mark_percentage || 0,
          enable_percentile !== undefined ? enable_percentile : true,
          enable_ai_interpretation !== undefined ? enable_ai_interpretation : true,
          enable_benchmark !== undefined ? enable_benchmark : true,
          enable_shortlist !== undefined ? enable_shortlist : true,
          status || 'draft',
          settings ? JSON.stringify(settings) : null,
          req.user.id
        ]
      );

      const testId = testResult.insertId;

      // Add category mappings
      if (category_ids && Array.isArray(category_ids)) {
        for (const categoryData of category_ids) {
          const categoryId = typeof categoryData === 'object' ? categoryData.id : categoryData;
          const weight = typeof categoryData === 'object' ? categoryData.weight : 1.0;

          await connection.execute(
            'INSERT INTO test_categories_mapping (test_id, category_id, weight) VALUES (?, ?, ?)',
            [testId, categoryId, weight]
          );
        }
      }

      return testId;
    });

    logger.info(`Test created: ${result} by user ${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'Test created successfully',
      data: { test_id: result }
    });
  } catch (error) {
    logger.error('Create test error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating test',
      error: error.message
    });
  }
};

// Update test
const updateTest = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId || req.user?.company_id;
    
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Company ID not found'
      });
    }
    const updateData = req.body;

    // Verify test exists and belongs to company
    const [tests] = await db.pool.execute(
      'SELECT id FROM tests WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    if (tests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    // Build update query
    const allowedFields = [
      'title', 'description', 'instructions', 'duration_minutes', 'passing_score',
      'max_attempts', 'negative_marking', 'negative_mark_percentage',
      'enable_percentile', 'enable_ai_interpretation', 'enable_benchmark',
      'enable_shortlist', 'status', 'settings'
    ];

    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        if (field === 'settings' && typeof updateData[field] === 'object') {
          updates.push(`${field} = ?`);
          values.push(JSON.stringify(updateData[field]));
        } else {
          updates.push(`${field} = ?`);
          values.push(updateData[field]);
        }
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    values.push(id, companyId);

    await db.query(
      `UPDATE tests SET ${updates.join(', ')} WHERE id = ? AND company_id = ?`,
      values
    );

    // Update categories if provided
    if (updateData.category_ids && Array.isArray(updateData.category_ids)) {
      // Delete existing mappings
      await db.query(
        'DELETE FROM test_categories_mapping WHERE test_id = ?',
        [id]
      );

      // Add new mappings
      for (const categoryData of updateData.category_ids) {
        const categoryId = typeof categoryData === 'object' ? categoryData.id : categoryData;
        const weight = typeof categoryData === 'object' ? categoryData.weight : 1.0;

        await db.query(
          'INSERT INTO test_categories_mapping (test_id, category_id, weight) VALUES (?, ?, ?)',
          [id, categoryId, weight]
        );
      }
    }

    logger.info(`Test updated: ${id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Test updated successfully'
    });
  } catch (error) {
    logger.error('Update test error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating test',
      error: error.message
    });
  }
};

// Delete test
const deleteTest = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId || req.user.company_id;

    const [tests] = await db.pool.execute(
      'SELECT id FROM tests WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    if (tests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    await db.query(
      'DELETE FROM tests WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    logger.info(`Test deleted: ${id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Test deleted successfully'
    });
  } catch (error) {
    logger.error('Delete test error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting test',
      error: error.message
    });
  }
};

// Clone test
const cloneTest = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId || req.user.company_id;
    const { new_title } = req.body;

    // Get original test
    const [tests] = await db.pool.execute(
      'SELECT * FROM tests WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    if (tests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    const originalTest = tests[0];

    // Start transaction
    const result = await db.transaction(async (connection) => {
      // Clone test with new title
      const clonedTitle = new_title || `${originalTest.title} (Copy)`;
      const [testResult] = await connection.execute(
        `INSERT INTO tests 
         (company_id, title, description, instructions, duration_minutes, passing_score,
          max_attempts, negative_marking, negative_mark_percentage, enable_percentile,
          enable_ai_interpretation, enable_benchmark, enable_shortlist, status, settings, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          companyId,
          clonedTitle,
          originalTest.description,
          originalTest.instructions,
          originalTest.duration_minutes,
          originalTest.passing_score,
          originalTest.max_attempts,
          originalTest.negative_marking,
          originalTest.negative_mark_percentage,
          originalTest.enable_percentile,
          originalTest.enable_ai_interpretation,
          originalTest.enable_benchmark,
          originalTest.enable_shortlist,
          'draft', // Cloned tests start as draft
          originalTest.settings,
          req.user.id
        ]
      );

      const newTestId = testResult.insertId;

      // Clone category mappings
      const [categories] = await connection.execute(
        'SELECT category_id, weight FROM test_categories_mapping WHERE test_id = ?',
        [id]
      );

      for (const category of categories) {
        await connection.execute(
          'INSERT INTO test_categories_mapping (test_id, category_id, weight) VALUES (?, ?, ?)',
          [newTestId, category.category_id, category.weight]
        );
      }

      // Clone test questions
      const [questions] = await connection.execute(
        'SELECT question_id, display_order FROM test_questions WHERE test_id = ?',
        [id]
      );

      for (const question of questions) {
        await connection.execute(
          'INSERT INTO test_questions (test_id, question_id, display_order) VALUES (?, ?, ?)',
          [newTestId, question.question_id, question.display_order]
        );
      }

      return newTestId;
    });

    logger.info(`Test cloned: ${id} -> ${result} by user ${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'Test cloned successfully',
      data: { test_id: result }
    });
  } catch (error) {
    logger.error('Clone test error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cloning test',
      error: error.message
    });
  }
};

module.exports = {
  getTests,
  getTest,
  createTest,
  updateTest,
  deleteTest,
  cloneTest
};


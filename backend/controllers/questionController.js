const db = require('../config/database');
const logger = require('../utils/logger');

// Get all questions
const getQuestions = async (req, res) => {
  try {
    const companyId = req.companyId || req.user.company_id;
    const { category_id, search, difficulty } = req.query;

    let query = `
      SELECT q.*, tc.name as category_name
      FROM questions q
      LEFT JOIN test_categories tc ON q.category_id = tc.id
      WHERE q.company_id = ?
    `;
    const params = [companyId];

    if (category_id) {
      query += ' AND q.category_id = ?';
      params.push(category_id);
    }

    if (difficulty) {
      query += ' AND q.difficulty = ?';
      params.push(difficulty);
    }

    if (search) {
      query += ' AND q.question_text LIKE ?';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY q.created_at DESC';

    const questions = await db.query(query, params);

    // Parse JSON fields
    const parsedQuestions = questions.map(q => ({
      ...q,
      options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
      correct_answer: typeof q.correct_answer === 'string' ? JSON.parse(q.correct_answer) : q.correct_answer,
      metadata: q.metadata ? (typeof q.metadata === 'string' ? JSON.parse(q.metadata) : q.metadata) : null
    }));

    res.json({
      success: true,
      data: parsedQuestions
    });
  } catch (error) {
    logger.error('Get questions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching questions',
      error: error.message
    });
  }
};

// Get single question
const getQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId || req.user.company_id;

    const [questions] = await db.pool.execute(
      `SELECT q.*, tc.name as category_name
       FROM questions q
       LEFT JOIN test_categories tc ON q.category_id = tc.id
       WHERE q.id = ? AND q.company_id = ?`,
      [id, companyId]
    );

    if (questions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    const question = questions[0];
    question.options = typeof question.options === 'string' ? JSON.parse(question.options) : question.options;
    question.correct_answer = typeof question.correct_answer === 'string' ? JSON.parse(question.correct_answer) : question.correct_answer;
    question.metadata = question.metadata ? (typeof question.metadata === 'string' ? JSON.parse(question.metadata) : question.metadata) : null;

    res.json({
      success: true,
      data: question
    });
  } catch (error) {
    logger.error('Get question error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching question',
      error: error.message
    });
  }
};

// Create question
const createQuestion = async (req, res) => {
  try {
    const companyId = req.companyId || req.user.company_id;
    const {
      category_id,
      question_text,
      question_type,
      options,
      correct_answer,
      points,
      negative_points,
      difficulty,
      explanation,
      metadata
    } = req.body;

    if (!question_text || !options || !correct_answer) {
      return res.status(400).json({
        success: false,
        message: 'question_text, options, and correct_answer are required'
      });
    }

    const [result] = await db.pool.execute(
      `INSERT INTO questions 
       (company_id, category_id, question_text, question_type, options, correct_answer,
        points, negative_points, difficulty, explanation, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        category_id || null,
        question_text,
        question_type || 'MCQ_SINGLE',
        JSON.stringify(options),
        JSON.stringify(correct_answer),
        points || 1.0,
        negative_points || 0.0,
        difficulty || 'medium',
        explanation || null,
        metadata ? JSON.stringify(metadata) : null
      ]
    );

    logger.info(`Question created: ${result.insertId} by user ${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'Question created successfully',
      data: { question_id: result.insertId }
    });
  } catch (error) {
    logger.error('Create question error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating question',
      error: error.message
    });
  }
};

// Update question
const updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId || req.user.company_id;
    const updateData = req.body;

    // Verify question exists
    const [questions] = await db.pool.execute(
      'SELECT id FROM questions WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    if (questions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    // Build update query
    const allowedFields = [
      'category_id', 'question_text', 'question_type', 'options', 'correct_answer',
      'points', 'negative_points', 'difficulty', 'explanation', 'metadata'
    ];

    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        if (['options', 'correct_answer', 'metadata'].includes(field) && typeof updateData[field] === 'object') {
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
      `UPDATE questions SET ${updates.join(', ')} WHERE id = ? AND company_id = ?`,
      values
    );

    logger.info(`Question updated: ${id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Question updated successfully'
    });
  } catch (error) {
    logger.error('Update question error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating question',
      error: error.message
    });
  }
};

// Delete question
const deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId || req.user.company_id;

    const [questions] = await db.pool.execute(
      'SELECT id FROM questions WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    if (questions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    await db.query(
      'DELETE FROM questions WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    logger.info(`Question deleted: ${id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Question deleted successfully'
    });
  } catch (error) {
    logger.error('Delete question error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting question',
      error: error.message
    });
  }
};

// Add question to test (supports single or multiple questions)
const addQuestionToTest = async (req, res) => {
  try {
    const { test_id, question_id, question_ids, display_order } = req.body;
    const companyId = req.companyId || req.user.company_id;

    // Support both single question_id and array of question_ids
    const questionIds = question_ids || (question_id ? [question_id] : []);

    if (!test_id || questionIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'test_id and question_id(s) are required'
      });
    }

    // Verify test belongs to company
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

    const added = [];
    const skipped = [];
    const errors = [];

    // Get current max display_order for this test
    const [maxOrder] = await db.pool.execute(
      'SELECT MAX(display_order) as max_order FROM test_questions WHERE test_id = ?',
      [test_id]
    );
    let currentOrder = (maxOrder[0]?.max_order || 0) + 1;

    for (const qId of questionIds) {
      try {
        // Check if already added
        const [existing] = await db.pool.execute(
          'SELECT id FROM test_questions WHERE test_id = ? AND question_id = ?',
          [test_id, qId]
        );

        if (existing.length > 0) {
          skipped.push(qId);
          continue;
        }

        await db.query(
          'INSERT INTO test_questions (test_id, question_id, display_order) VALUES (?, ?, ?)',
          [test_id, qId, display_order || currentOrder++]
        );
        added.push(qId);
      } catch (error) {
        errors.push({ question_id: qId, error: error.message });
        logger.error(`Error adding question ${qId} to test:`, error);
      }
    }

    res.json({
      success: true,
      message: `${added.length} question(s) added successfully`,
      data: {
        added: added.length,
        skipped: skipped.length,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    logger.error('Add question to test error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding question to test',
      error: error.message
    });
  }
};

// Remove question from test
const removeQuestionFromTest = async (req, res) => {
  try {
    const { test_id, question_id } = req.params;
    const companyId = req.companyId || req.user.company_id;

    // Verify test belongs to company
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

    await db.query(
      'DELETE FROM test_questions WHERE test_id = ? AND question_id = ?',
      [test_id, question_id]
    );

    res.json({
      success: true,
      message: 'Question removed from test successfully'
    });
  } catch (error) {
    logger.error('Remove question from test error:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing question from test',
      error: error.message
    });
  }
};

module.exports = {
  getQuestions,
  getQuestion,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  addQuestionToTest,
  removeQuestionFromTest
};


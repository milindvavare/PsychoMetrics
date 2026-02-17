const db = require('../config/database');
const logger = require('../utils/logger');

// Create category
const createCategory = async (req, res) => {
  try {
    const companyId = req.companyId || req.user.company_id;
    const { name, description, weight, reverse_score } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      });
    }

    const [result] = await db.pool.execute(
      `INSERT INTO test_categories (company_id, name, description, weight, reverse_score)
       VALUES (?, ?, ?, ?, ?)`,
      [
        companyId,
        name,
        description || null,
        weight || 1.0,
        reverse_score || false
      ]
    );

    logger.info(`Category created: ${result.insertId} - ${name}`);

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: { category_id: result.insertId }
    });
  } catch (error) {
    logger.error('Create category error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating category',
      error: error.message
    });
  }
};

// Get categories
const getCategories = async (req, res) => {
  try {
    const companyId = req.companyId || req.user.company_id;

    const categories = await db.query(
      'SELECT * FROM test_categories WHERE company_id = ? ORDER BY name',
      [companyId]
    );

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    logger.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: error.message
    });
  }
};

// Get single category
const getCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId || req.user.company_id;

    const [categories] = await db.pool.execute(
      'SELECT * FROM test_categories WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    if (categories.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.json({
      success: true,
      data: categories[0]
    });
  } catch (error) {
    logger.error('Get category error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching category',
      error: error.message
    });
  }
};

// Update category
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId || req.user.company_id;
    const updateData = req.body;

    // Verify category exists
    const [categories] = await db.pool.execute(
      'SELECT id FROM test_categories WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    if (categories.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Build update query
    const allowedFields = ['name', 'description', 'weight', 'reverse_score'];
    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(updateData[field]);
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
      `UPDATE test_categories SET ${updates.join(', ')} WHERE id = ? AND company_id = ?`,
      values
    );

    logger.info(`Category updated: ${id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Category updated successfully'
    });
  } catch (error) {
    logger.error('Update category error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating category',
      error: error.message
    });
  }
};

// Delete category
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId || req.user.company_id;

    const [categories] = await db.pool.execute(
      'SELECT id FROM test_categories WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    if (categories.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    await db.query(
      'DELETE FROM test_categories WHERE id = ? AND company_id = ?',
      [id, companyId]
    );

    logger.info(`Category deleted: ${id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    logger.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting category',
      error: error.message
    });
  }
};

module.exports = {
  createCategory,
  getCategories,
  getCategory,
  updateCategory,
  deleteCategory
};


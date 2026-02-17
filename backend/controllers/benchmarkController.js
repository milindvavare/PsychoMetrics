const db = require('../config/database');
const logger = require('../utils/logger');

// Get benchmark comparison
const getBenchmarkComparison = async (req, res) => {
  try {
    const { attempt_id } = req.params;
    const companyId = req.companyId || req.user.company_id;

    // Get attempt and verify access
    const [attempts] = await db.pool.execute(
      `SELECT ta.*, t.company_id, t.enable_benchmark
       FROM test_attempts ta
       JOIN tests t ON ta.test_id = t.id
       WHERE ta.id = ? AND t.company_id = ?`,
      [attempt_id, companyId]
    );

    if (attempts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Attempt not found'
      });
    }

    const attempt = attempts[0];

    if (!attempt.enable_benchmark) {
      return res.status(400).json({
        success: false,
        message: 'Benchmark comparison is not enabled for this test'
      });
    }

    // Get candidate score
    const [scores] = await db.pool.execute(
      'SELECT * FROM scores WHERE attempt_id = ?',
      [attempt_id]
    );

    if (scores.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Score not found for this attempt'
      });
    }

    const candidateScore = scores[0];
    const candidateCategoryScores = typeof candidateScore.category_scores === 'string' 
      ? JSON.parse(candidateScore.category_scores) 
      : candidateScore.category_scores;

    // Get benchmarks for this test
    const benchmarks = await db.query(
      `SELECT * FROM benchmarks 
       WHERE (test_id = ? OR test_id IS NULL) AND company_id = ?
       ORDER BY benchmark_name`,
      [attempt.test_id, companyId]
    );

    // Get test statistics for comparison
    const [stats] = await db.pool.execute(
      `SELECT 
        AVG(percentage_score) as average_score,
        MIN(percentage_score) as min_score,
        MAX(percentage_score) as max_score,
        STDDEV(percentage_score) as std_deviation
       FROM scores
       WHERE test_id = ?`,
      [attempt.test_id]
    );

    // Compare with benchmarks
    const comparison = {
      candidate_score: candidateScore.percentage_score,
      candidate_percentile: candidateScore.percentile,
      test_statistics: stats[0],
      benchmarks: [],
      category_comparisons: {}
    };

    // Compare overall score with benchmarks
    for (const benchmark of benchmarks) {
      const benchmarkRange = typeof benchmark.percentile_range === 'string' 
        ? JSON.parse(benchmark.percentile_range) 
        : benchmark.percentile_range;

      let matches = false;
      if (benchmark.min_score && benchmark.max_score) {
        matches = candidateScore.percentage_score >= benchmark.min_score && 
                  candidateScore.percentage_score <= benchmark.max_score;
      } else if (benchmarkRange && candidateScore.percentile) {
        matches = candidateScore.percentile >= (benchmarkRange.min || 0) && 
                  candidateScore.percentile <= (benchmarkRange.max || 100);
      }

      comparison.benchmarks.push({
        name: benchmark.benchmark_name,
        description: benchmark.description,
        matches,
        benchmark_range: {
          min: benchmark.min_score || (benchmarkRange ? benchmarkRange.min : null),
          max: benchmark.max_score || (benchmarkRange ? benchmarkRange.max : null)
        }
      });
    }

    // Compare category scores
    for (const categoryId in candidateCategoryScores) {
      const category = candidateCategoryScores[categoryId];
      
      // Get category benchmarks
      const categoryBenchmarks = benchmarks.filter(b => b.category_id === parseInt(categoryId));
      
      const categoryComparison = {
        category_name: category.category_name,
        candidate_score: category.percentage,
        benchmarks: []
      };

      for (const benchmark of categoryBenchmarks) {
        const benchmarkRange = typeof benchmark.percentile_range === 'string' 
          ? JSON.parse(benchmark.percentile_range) 
          : benchmark.percentile_range;

        let matches = false;
        if (benchmark.min_score && benchmark.max_score) {
          matches = category.percentage >= benchmark.min_score && 
                    category.percentage <= benchmark.max_score;
        }

        categoryComparison.benchmarks.push({
          name: benchmark.benchmark_name,
          matches,
          benchmark_range: {
            min: benchmark.min_score,
            max: benchmark.max_score
          }
        });
      }

      comparison.category_comparisons[categoryId] = categoryComparison;
    }

    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    logger.error('Get benchmark comparison error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating benchmark comparison',
      error: error.message
    });
  }
};

// Create benchmark
const createBenchmark = async (req, res) => {
  try {
    const companyId = req.companyId || req.user.company_id;
    const {
      test_id,
      category_id,
      benchmark_name,
      min_score,
      max_score,
      percentile_range,
      description
    } = req.body;

    if (!benchmark_name) {
      return res.status(400).json({
        success: false,
        message: 'benchmark_name is required'
      });
    }

    const [result] = await db.pool.execute(
      `INSERT INTO benchmarks 
       (company_id, test_id, category_id, benchmark_name, min_score, max_score, percentile_range, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        test_id || null,
        category_id || null,
        benchmark_name,
        min_score || null,
        max_score || null,
        percentile_range ? JSON.stringify(percentile_range) : null,
        description || null
      ]
    );

    logger.info(`Benchmark created: ${result.insertId} by user ${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'Benchmark created successfully',
      data: { benchmark_id: result.insertId }
    });
  } catch (error) {
    logger.error('Create benchmark error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating benchmark',
      error: error.message
    });
  }
};

// Get benchmarks
const getBenchmarks = async (req, res) => {
  try {
    const companyId = req.companyId || req.user.company_id;
    const { test_id, category_id } = req.query;

    let query = 'SELECT * FROM benchmarks WHERE company_id = ?';
    const params = [companyId];

    if (test_id) {
      query += ' AND (test_id = ? OR test_id IS NULL)';
      params.push(test_id);
    }

    if (category_id) {
      query += ' AND (category_id = ? OR category_id IS NULL)';
      params.push(category_id);
    }

    query += ' ORDER BY benchmark_name';

    const benchmarks = await db.query(query, params);

    // Parse JSON fields
    const parsedBenchmarks = benchmarks.map(b => ({
      ...b,
      percentile_range: b.percentile_range 
        ? (typeof b.percentile_range === 'string' ? JSON.parse(b.percentile_range) : b.percentile_range)
        : null
    }));

    res.json({
      success: true,
      data: parsedBenchmarks
    });
  } catch (error) {
    logger.error('Get benchmarks error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching benchmarks',
      error: error.message
    });
  }
};

module.exports = {
  getBenchmarkComparison,
  createBenchmark,
  getBenchmarks
};


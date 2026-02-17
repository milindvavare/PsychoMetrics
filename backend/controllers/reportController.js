const PDFDocument = require('pdfkit');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const db = require('../config/database');
const logger = require('../utils/logger');

// Generate PDF report
const generatePDFReport = async (req, res) => {
  try {
    const { attempt_id } = req.params;
    const { report_type = 'detailed' } = req.query;
    const companyId = req.companyId || req.user.company_id;

    // Get attempt and verify access
    const [attempts] = await db.pool.execute(
      `SELECT ta.*, t.title as test_title, t.description as test_description, t.company_id,
              c.first_name, c.last_name, c.email
       FROM test_attempts ta
       JOIN tests t ON ta.test_id = t.id
       JOIN candidates c ON ta.candidate_id = c.id
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

    // Get score
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

    const score = scores[0];
    const categoryScores = typeof score.category_scores === 'string' 
      ? JSON.parse(score.category_scores) 
      : score.category_scores;

    // Get answers
    const answers = await db.query(
      `SELECT a.*, q.question_text, q.question_type, q.points, q.explanation
       FROM answers a
       JOIN questions q ON a.question_id = q.id
       WHERE a.attempt_id = ?
       ORDER BY a.answered_at ASC`,
      [attempt_id]
    );

    // Get AI interpretation if available
    const [interpretations] = await db.pool.execute(
      'SELECT * FROM ai_interpretations WHERE attempt_id = ?',
      [attempt_id]
    );

    let interpretation = null;
    if (interpretations.length > 0) {
      interpretation = interpretations[0];
      interpretation.strengths = typeof interpretation.strengths === 'string' 
        ? JSON.parse(interpretation.strengths) 
        : interpretation.strengths;
      interpretation.weaknesses = typeof interpretation.weaknesses === 'string' 
        ? JSON.parse(interpretation.weaknesses) 
        : interpretation.weaknesses;
      interpretation.recommendations = typeof interpretation.recommendations === 'string' 
        ? JSON.parse(interpretation.recommendations) 
        : interpretation.recommendations;
    }

    // Get suspicious activity data
    const suspiciousActivity = attempt.suspicious_activity 
      ? (typeof attempt.suspicious_activity === 'string' 
          ? JSON.parse(attempt.suspicious_activity) 
          : attempt.suspicious_activity)
      : null;

    // Create reports directory if it doesn't exist
    const reportsDir = path.join(__dirname, '../../reports');
    await fsPromises.mkdir(reportsDir, { recursive: true });

    // Generate PDF
    const fileName = `report_${attempt_id}_${Date.now()}.pdf`;
    const filePath = path.join(reportsDir, fileName);

    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Header with styling
    doc.fontSize(24)
       .fillColor('#667eea')
       .text('PSYCHOMETRICS TEST REPORT', { align: 'center', bold: true });
    doc.moveDown(0.5);
    doc.fontSize(12)
       .fillColor('#666666')
       .text(`Report ID: ${attempt_id}`, { align: 'center' });
    doc.moveDown();

    // Candidate Information
    doc.fontSize(16)
       .fillColor('#000000')
       .text('Candidate Information', { underline: true, bold: true });
    doc.fontSize(12);
    doc.text(`Name: ${attempt.first_name} ${attempt.last_name}`);
    doc.text(`Email: ${attempt.email}`);
    doc.text(`Test: ${attempt.test_title}`);
    doc.text(`Date: ${new Date(attempt.submitted_at).toLocaleDateString()}`);
    doc.text(`Time Taken: ${attempt.time_taken_seconds ? Math.floor(attempt.time_taken_seconds / 60) + ' minutes' : 'N/A'}`);
    if (attempt.ip_address) {
      doc.text(`IP Address: ${attempt.ip_address}`);
    }
    doc.moveDown();

    // Score Summary with visual emphasis
    doc.fontSize(16)
       .fillColor('#000000')
       .text('Score Summary', { underline: true, bold: true });
    doc.fontSize(12);
    doc.text(`Total Score: ${score.total_score} / ${score.max_score}`);
    doc.text(`Percentage: ${score.percentage_score}%`);
    if (score.percentile) {
      doc.text(`Percentile: ${score.percentile}%`);
    }
    doc.fillColor(score.passed ? '#28a745' : '#dc3545')
       .text(`Status: ${score.passed ? 'PASSED' : 'FAILED'}`, { bold: true });
    doc.fillColor('#000000');
    doc.moveDown();

    // Category Scores
    if (Object.keys(categoryScores).length > 0) {
      doc.fontSize(16).text('Category Scores', { underline: true });
      doc.fontSize(12);
      
      for (const categoryId in categoryScores) {
        const category = categoryScores[categoryId];
        doc.text(`${category.category_name}: ${category.percentage}% (${category.score}/${category.max_score})`);
      }
      doc.moveDown();
    }

    // AI Interpretation
    if (interpretation) {
      doc.fontSize(16).text('AI Interpretation', { underline: true });
      doc.fontSize(12);
      doc.text(interpretation.interpretation_text);
      doc.moveDown();

      if (interpretation.strengths && interpretation.strengths.length > 0) {
        doc.fontSize(14).text('Strengths:', { underline: true });
        interpretation.strengths.forEach(strength => {
          doc.text(`• ${strength.message || strength.category}`);
        });
        doc.moveDown();
      }

      if (interpretation.weaknesses && interpretation.weaknesses.length > 0) {
        doc.fontSize(14).text('Areas for Improvement:', { underline: true });
        interpretation.weaknesses.forEach(weakness => {
          doc.text(`• ${weakness.message || weakness.category}`);
        });
        doc.moveDown();
      }

      if (interpretation.recommendations && interpretation.recommendations.length > 0) {
        doc.fontSize(14).text('Recommendations:', { underline: true });
        interpretation.recommendations.forEach(rec => {
          doc.text(`• ${rec.suggestion || rec.category}`);
        });
        doc.moveDown();
      }
    }

    // Security & Integrity Section
    if (suspiciousActivity || attempt.tab_switches > 0) {
      doc.addPage();
      doc.fontSize(16)
         .fillColor('#000000')
         .text('Test Integrity Report', { underline: true, bold: true });
      doc.fontSize(12);
      
      if (attempt.tab_switches > 0) {
        doc.fillColor('#ff9800')
           .text(`Tab Switches Detected: ${attempt.tab_switches}`, { bold: true });
        doc.fillColor('#000000');
      }
      
      if (suspiciousActivity) {
        doc.text('Suspicious Activities:', { bold: true });
        if (suspiciousActivity.tab_switches) {
          doc.text(`  • Tab switches: ${suspiciousActivity.tab_switches}`);
        }
        if (suspiciousActivity.copy) {
          doc.text(`  • Copy attempts: ${suspiciousActivity.copy.count || 0}`);
        }
        if (suspiciousActivity.paste) {
          doc.text(`  • Paste attempts: ${suspiciousActivity.paste.count || 0}`);
        }
        if (suspiciousActivity.right_click) {
          doc.text(`  • Right-click attempts: ${suspiciousActivity.right_click.count || 0}`);
        }
        if (suspiciousActivity.dev_tools) {
          doc.text(`  • Developer tools opened: Yes`);
        }
        if (suspiciousActivity.all_activities && suspiciousActivity.all_activities.length > 0) {
          doc.text('Activity Timeline:', { bold: true });
          suspiciousActivity.all_activities.slice(-10).forEach((activity, idx) => {
            doc.fontSize(10)
               .text(`  ${idx + 1}. ${activity.type} - ${new Date(activity.timestamp).toLocaleString()}`);
          });
        }
      }
      
      doc.fillColor('#000000');
      doc.moveDown();
    }

    // Detailed Answers (if detailed report)
    if (report_type === 'detailed' && answers.length > 0) {
      doc.addPage();
      doc.fontSize(16).text('Question Details', { underline: true });
      doc.fontSize(12);

      answers.forEach((answer, index) => {
        doc.text(`Question ${index + 1}:`, { bold: true });
        doc.text(answer.question_text);
        doc.text(`Answer: ${JSON.stringify(answer.answer_data)}`);
        doc.text(`Correct: ${answer.is_correct ? 'Yes' : 'No'}`);
        doc.text(`Points: ${answer.points_earned}`);
        if (answer.explanation) {
          doc.text(`Explanation: ${answer.explanation}`);
        }
        doc.moveDown(0.5);
      });
    }

    // Footer
    doc.fontSize(10).text(
      `Generated on ${new Date().toLocaleString()}`,
      { align: 'center' }
    );

    doc.end();

    // Wait for PDF to be generated
    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    // Save report record
    await db.query(
      'INSERT INTO reports (attempt_id, report_type, file_path) VALUES (?, ?, ?)',
      [attempt_id, report_type, filePath]
    );

    logger.info(`PDF report generated: ${filePath} for attempt ${attempt_id}`);

    // Send file
    res.download(filePath, fileName, (err) => {
      if (err) {
        logger.error('Error sending PDF:', err);
      }
      // Optionally delete file after sending
      // fs.unlink(filePath).catch(console.error);
    });
  } catch (error) {
    logger.error('Generate PDF report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating PDF report',
      error: error.message
    });
  }
};

module.exports = {
  generatePDFReport
};


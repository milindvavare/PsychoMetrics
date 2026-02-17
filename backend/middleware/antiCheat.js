const logger = require('../utils/logger');

// Track tab switches and suspicious activity
const trackTabActivity = async (req, res, next) => {
  try {
    const attemptId = req.body.attempt_id || req.params.attemptId;
    const tabSwitch = req.body.tab_switch || false;
    const suspiciousActivity = req.body.suspicious_activity || {};

    if (attemptId && tabSwitch) {
      const db = require('../config/database');
      
      // Increment tab switch count
      await db.query(
        'UPDATE test_attempts SET tab_switches = tab_switches + 1 WHERE id = ?',
        [attemptId]
      );

      // Log suspicious activity
      if (Object.keys(suspiciousActivity).length > 0) {
        const [attempts] = await db.pool.execute(
          'SELECT suspicious_activity FROM test_attempts WHERE id = ?',
          [attemptId]
        );

        const existingActivity = attempts[0]?.suspicious_activity 
          ? JSON.parse(attempts[0].suspicious_activity) 
          : {};

        const updatedActivity = {
          ...existingActivity,
          ...suspiciousActivity,
          tab_switches: (existingActivity.tab_switches || 0) + 1,
          last_updated: new Date().toISOString()
        };

        await db.query(
          'UPDATE test_attempts SET suspicious_activity = ? WHERE id = ?',
          [JSON.stringify(updatedActivity), attemptId]
        );

        logger.warn(`Suspicious activity detected for attempt ${attemptId}`, updatedActivity);
        
        // Also update tab_switches count if provided
        if (suspiciousActivity.tab_switches) {
          await db.query(
            'UPDATE test_attempts SET tab_switches = ? WHERE id = ?',
            [suspiciousActivity.tab_switches, attemptId]
          );
        }
      }
    }

    next();
  } catch (error) {
    logger.error('Tab activity tracking error:', error);
    next(); // Don't block the request
  }
};

// Log IP address for attempts
const logIPAddress = async (req, res, next) => {
  try {
    const attemptId = req.body.attempt_id || req.params.attemptId;
    
    if (attemptId) {
      const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
      const userAgent = req.headers['user-agent'];
      
      const db = require('../config/database');
      
      await db.query(
        'UPDATE test_attempts SET ip_address = ?, user_agent = ? WHERE id = ?',
        [ipAddress, userAgent, attemptId]
      );
    }

    next();
  } catch (error) {
    logger.error('IP logging error:', error);
    next(); // Don't block the request
  }
};

// Check attempt limits
const checkAttemptLimit = async (req, res, next) => {
  try {
    const { test_id, candidate_id } = req.body;
    
    if (!test_id || !candidate_id) {
      return next();
    }

    const db = require('../config/database');
    
    // Get test max attempts
    const [tests] = await db.pool.execute(
      'SELECT max_attempts FROM tests WHERE id = ?',
      [test_id]
    );

    if (tests.length === 0) {
      return res.status(404).json({ success: false, message: 'Test not found' });
    }

    const maxAttempts = tests[0].max_attempts || 1;

    // Count existing attempts
    const [attempts] = await db.pool.execute(
      'SELECT COUNT(*) as count FROM test_attempts WHERE test_id = ? AND candidate_id = ?',
      [test_id, candidate_id]
    );

    const attemptCount = attempts[0].count;

    if (attemptCount >= maxAttempts) {
      return res.status(403).json({
        success: false,
        message: `Maximum attempts (${maxAttempts}) reached for this test`
      });
    }

    req.attemptNumber = attemptCount + 1;
    next();
  } catch (error) {
    logger.error('Attempt limit check error:', error);
    return res.status(500).json({ success: false, message: 'Error checking attempt limit' });
  }
};

module.exports = {
  trackTabActivity,
  logIPAddress,
  checkAttemptLimit
};


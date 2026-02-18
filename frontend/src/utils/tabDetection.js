// Enhanced Anti-Cheating Detection System
class TabDetection {
  constructor(onTabSwitch) {
    this.tabSwitchCount = 0;
    this.isTabActive = true;
    this.onTabSwitch = onTabSwitch;
    this.fullscreenExitCount = 0;
    this.copyPasteCount = 0;
    this.rightClickCount = 0;
    this.windowResizeCount = 0;
    this.devToolsOpen = false;
    this.suspiciousActivities = [];
    // Debouncing for tab switches to prevent double counting
    this.lastTabSwitchTime = 0;
    this.tabSwitchDebounceMs = 500; // Only count one switch per 500ms
    this.setupListeners();
  }

  setupListeners() {
    // Use visibilitychange as primary detection (most reliable)
    // Only use blur as backup, and don't use keydown Alt+Tab to avoid triple counting
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.handleTabSwitch();
      } else {
        this.isTabActive = true;
      }
    });

    // Window blur/focus detection - only use if visibilitychange didn't fire
    // Add a small delay to check if visibilitychange already handled it
    let blurTimeout;
    window.addEventListener('blur', () => {
      // Only count if visibilitychange didn't already fire (check after a short delay)
      blurTimeout = setTimeout(() => {
        // If document is still hidden and we haven't counted recently, count it
        if (document.hidden && (Date.now() - this.lastTabSwitchTime) >= this.tabSwitchDebounceMs) {
          this.handleTabSwitch();
        }
      }, 100);
    });

    window.addEventListener('focus', () => {
      clearTimeout(blurTimeout);
      this.isTabActive = true;
    });


    // Detect if user tries to leave fullscreen
    // Track fullscreen exit count separately with debouncing
    this.lastFullscreenExitTime = 0;
    this.fullscreenExitDebounceMs = 500;
    let wasFullscreen = !!document.fullscreenElement || 
                        !!document.webkitFullscreenElement || 
                        !!document.mozFullScreenElement || 
                        !!document.msFullscreenElement;
    
    const handleFullscreenChange = () => {
      const isFullscreen = !!(document.fullscreenElement || 
                              document.webkitFullscreenElement || 
                              document.mozFullScreenElement || 
                              document.msFullscreenElement);
      
      // Only count when transitioning from fullscreen to non-fullscreen
      if (wasFullscreen && !isFullscreen) {
        const now = Date.now();
        const timeSinceLastExit = now - this.lastFullscreenExitTime;
        
        // Debounce: Only count if enough time has passed
        if (timeSinceLastExit >= this.fullscreenExitDebounceMs) {
          this.fullscreenExitCount++;
          this.lastFullscreenExitTime = now;
          
          this.handleSuspiciousActivity('fullscreen_exit', {
            count: this.fullscreenExitCount,
            timestamp: new Date().toISOString()
          });
          
          // Notify callback if available
          if (this.onTabSwitch) {
            this.onTabSwitch({
              fullscreen_exit: true,
              fullscreen_exit_count: this.fullscreenExitCount,
              suspicious_activity: {
                type: 'fullscreen_exit',
                count: this.fullscreenExitCount,
                timestamp: new Date().toISOString()
              }
            });
          }
        }
      }
      
      wasFullscreen = isFullscreen;
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    // Detect dev tools opening (using console detection)
    let devToolsOpen = false;
    const checkDevTools = () => {
      const widthThreshold = window.outerWidth - window.innerWidth > 160;
      const heightThreshold = window.outerHeight - window.innerHeight > 160;
      
      if (widthThreshold || heightThreshold) {
        if (!devToolsOpen) {
          devToolsOpen = true;
          this.handleDevTools();
        }
      } else {
        devToolsOpen = false;
      }
    };
    
    setInterval(checkDevTools, 1000);

    // Copy/Paste detection
    document.addEventListener('copy', (e) => {
      this.handleCopyPaste('copy');
      e.preventDefault();
      return false;
    });

    document.addEventListener('paste', (e) => {
      this.handleCopyPaste('paste');
      e.preventDefault();
      return false;
    });

    // Right-click detection (context menu)
    document.addEventListener('contextmenu', (e) => {
      this.handleRightClick();
      e.preventDefault();
      return false;
    });

    // Window resize detection (could indicate screenshot or dev tools)
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        this.handleWindowResize();
      }, 500);
    });

    // Keyboard shortcuts detection (F12, Ctrl+Shift+I, etc.)
    // Note: Alt+Tab is NOT handled here to avoid double counting
    // It will be caught by visibilitychange and blur events
    document.addEventListener('keydown', (e) => {
      // Windows key + Tab (Windows 10/11 task view) - only track if not already counted
      if (e.key === 'Meta' || e.key === 'OSLeft' || e.key === 'OSRight') {
        // Will be caught by visibilitychange/blur events, so we don't count here
        // Just prevent default
        e.preventDefault();
        return false;
      }
      
      // F12 - Dev Tools
      if (e.key === 'F12') {
        this.handleDevTools();
        e.preventDefault();
        return false;
      }
      // Ctrl+Shift+I - Dev Tools
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
        this.handleDevTools();
        e.preventDefault();
        return false;
      }
      // Ctrl+Shift+J - Console
      if (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) {
        this.handleDevTools();
        e.preventDefault();
        return false;
      }
      // Ctrl+Shift+C - Inspect Element
      if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        this.handleDevTools();
        e.preventDefault();
        return false;
      }
      // Ctrl+U - View Source
      if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
        this.handleSuspiciousActivity('view_source_attempt');
        e.preventDefault();
        return false;
      }
      // Print Screen
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        this.handleSuspiciousActivity('screenshot_attempt');
        e.preventDefault();
        return false;
      }
      // Ctrl+P - Print (could be used to screenshot)
      if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) {
        this.handleSuspiciousActivity('print_attempt');
        e.preventDefault();
        return false;
      }
      // Ctrl+S - Save page
      if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
        this.handleSuspiciousActivity('save_page_attempt');
        e.preventDefault();
        return false;
      }
      // Ctrl+A - Select All (prevent)
      if (e.ctrlKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        return false;
      }
    });

    // Disable text selection
    document.addEventListener('selectstart', (e) => {
      e.preventDefault();
      return false;
    });

    // Disable drag
    document.addEventListener('dragstart', (e) => {
      e.preventDefault();
      return false;
    });
  }

  handleTabSwitch() {
    // Debounce: Only count if enough time has passed since last switch
    const now = Date.now();
    const timeSinceLastSwitch = now - this.lastTabSwitchTime;
    
    // Only count if tab was active AND enough time has passed (prevent double counting)
    if (this.isTabActive && timeSinceLastSwitch >= this.tabSwitchDebounceMs) {
      this.tabSwitchCount++;
      this.isTabActive = false;
      this.lastTabSwitchTime = now;
      
      this.recordSuspiciousActivity('tab_switch', {
        count: this.tabSwitchCount,
        timestamp: new Date().toISOString()
      });
      
      if (this.onTabSwitch) {
        this.onTabSwitch({
          tab_switches: this.tabSwitchCount,
          suspicious_activity: {
            tab_switch: true,
            timestamp: new Date().toISOString()
          }
        });
      }
    }
  }

  handleCopyPaste(type) {
    this.copyPasteCount++;
    this.recordSuspiciousActivity(type, {
      count: this.copyPasteCount,
      timestamp: new Date().toISOString()
    });
  }

  handleRightClick() {
    this.rightClickCount++;
    this.recordSuspiciousActivity('right_click', {
      count: this.rightClickCount,
      timestamp: new Date().toISOString()
    });
  }

  handleWindowResize() {
    this.windowResizeCount++;
    this.recordSuspiciousActivity('window_resize', {
      count: this.windowResizeCount,
      timestamp: new Date().toISOString()
    });
  }

  handleDevTools() {
    this.devToolsOpen = true;
    this.recordSuspiciousActivity('dev_tools', {
      timestamp: new Date().toISOString()
    });
  }

  handleSuspiciousActivity(type) {
    this.recordSuspiciousActivity(type, {
      timestamp: new Date().toISOString()
    });
  }

  recordSuspiciousActivity(type, data) {
    this.suspiciousActivities.push({
      type,
      ...data
    });

    // Send to backend periodically or on critical events
    if (this.onTabSwitch && (type === 'tab_switch' || type === 'dev_tools')) {
      this.onTabSwitch({
        tab_switches: this.tabSwitchCount,
        suspicious_activity: {
          ...data,
          type,
          all_activities: this.suspiciousActivities.slice(-10) // Last 10 activities
        }
      });
    }
  }

  getTabSwitchCount() {
    return this.tabSwitchCount;
  }

  getSuspiciousActivities() {
    return {
      tab_switches: this.tabSwitchCount,
      fullscreen_exits: this.fullscreenExitCount || 0,
      copy_paste: this.copyPasteCount,
      right_clicks: this.rightClickCount,
      window_resizes: this.windowResizeCount,
      dev_tools_opened: this.devToolsOpen,
      all_activities: this.suspiciousActivities
    };
  }
  
  getFullscreenExitCount() {
    return this.fullscreenExitCount || 0;
  }

  reset() {
    this.tabSwitchCount = 0;
    this.isTabActive = true;
    this.fullscreenExitCount = 0;
    this.copyPasteCount = 0;
    this.rightClickCount = 0;
    this.windowResizeCount = 0;
    this.devToolsOpen = false;
    this.suspiciousActivities = [];
  }

  destroy() {
    // Cleanup would be handled by React's useEffect cleanup
    // But we can't easily remove all listeners without storing references
  }
}

export default TabDetection;


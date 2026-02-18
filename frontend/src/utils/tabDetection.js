// Enhanced Anti-Cheating Detection System
class TabDetection {
  constructor(onTabSwitch) {
    this.tabSwitchCount = 0;
    this.isTabActive = true;
    this.onTabSwitch = onTabSwitch;
    this.copyPasteCount = 0;
    this.rightClickCount = 0;
    this.windowResizeCount = 0;
    this.devToolsOpen = false;
    this.suspiciousActivities = [];
    this.setupListeners();
  }

  setupListeners() {
    // Visibility change detection
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.handleTabSwitch();
      } else {
        this.isTabActive = true;
      }
    });

    // Window blur/focus detection
    window.addEventListener('blur', () => {
      this.handleTabSwitch();
    });

    window.addEventListener('focus', () => {
      this.isTabActive = true;
    });

    // Detect if user tries to leave fullscreen
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) {
        this.handleSuspiciousActivity('fullscreen_exit', {
          timestamp: new Date().toISOString()
        });
      }
    });

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
    document.addEventListener('keydown', (e) => {
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
    if (this.isTabActive) {
      this.tabSwitchCount++;
      this.isTabActive = false;
      
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
      copy_paste: this.copyPasteCount,
      right_clicks: this.rightClickCount,
      window_resizes: this.windowResizeCount,
      dev_tools_opened: this.devToolsOpen,
      all_activities: this.suspiciousActivities
    };
  }

  reset() {
    this.tabSwitchCount = 0;
    this.isTabActive = true;
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


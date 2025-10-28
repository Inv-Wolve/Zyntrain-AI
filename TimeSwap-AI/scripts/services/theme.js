/**
 * Theme Management Service
 * Handles application theme switching and persistence
 */

export class ThemeManager {
  static THEMES = {
    LIGHT: 'light',
    DARK: 'dark'
  };

  static STORAGE_KEY = 'theme';

  static getCurrentTheme() {
    return localStorage.getItem(this.STORAGE_KEY) || this.THEMES.LIGHT;
  }

  static applyTheme(theme) {
    if (!Object.values(this.THEMES).includes(theme)) {
      console.warn(`Invalid theme: ${theme}`);
      return;
    }

    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(this.STORAGE_KEY, theme);
    
    // Update theme color meta tag
    this.updateThemeColorMeta(theme);
    
    // Dispatch theme change event
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
  }

  static toggleTheme() {
    const currentTheme = this.getCurrentTheme();
    const newTheme = currentTheme === this.THEMES.LIGHT ? this.THEMES.DARK : this.THEMES.LIGHT;
    this.applyTheme(newTheme);
    return newTheme;
  }

  static updateThemeColorMeta(theme) {
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      const color = theme === this.THEMES.DARK ? '#1C1C1C' : '#2563eb';
      themeMeta.setAttribute('content', color);
    }
  }

  static init() {
    this.applyTheme(this.getCurrentTheme());
    
    // Listen for system theme changes
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', (e) => {
        if (!localStorage.getItem(this.STORAGE_KEY)) {
          this.applyTheme(e.matches ? this.THEMES.DARK : this.THEMES.LIGHT);
        }
      });
    }
  }
}

// Global export for backward compatibility
window.ThemeManager = ThemeManager;
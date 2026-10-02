'use client';
import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({});

export function ThemeProvider({ children }: any) {
  const [theme, setTheme] = useState('light');
  
  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);
  
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

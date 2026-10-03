import fs from 'fs';

let content = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Add imports
content = content.replace(
  "import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';",
  "import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';\nimport { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';"
);

// 2. Replace currentView state
const currentViewStatePattern = /  const \[currentView, setCurrentView\] = useState\(\(\) => \{[\s\S]*?    return sessionStorage\.getItem\('gst_currentView'\) \|\| 'dashboard';\n  \}\);/;
const newCurrentViewLogic = `  const location = useLocation();
  const navigate = useNavigate();

  const currentView = (() => {
    if (location.pathname.startsWith('/app/')) {
      const v = location.pathname.substring(5);
      return v || 'dashboard';
    }
    try {
      const params = new URLSearchParams(window.location.search);
      const v = params.get('view');
      if (v) return v;
    } catch { /* ignore */ }
    return sessionStorage.getItem('gst_currentView') || 'dashboard';
  })();

  const setCurrentView = (view) => {
    navigate('/app/' + view);
  };

  useEffect(() => {
    if (location.pathname.startsWith('/app/')) {
      sessionStorage.setItem('gst_currentView', currentView);
    }
  }, [currentView, location.pathname]);`;

content = content.replace(currentViewStatePattern, newCurrentViewLogic);

// 3. Remove existing early returns for isAuthenticated and showWelcome
const notAuthPattern = /  if \(\!isAuthenticated\) \{[\s\S]*?  \}/;
content = content.replace(notAuthPattern, '');

const showWelcomePattern = /  if \(showWelcome\) \{[\s\S]*?  \}/;
content = content.replace(showWelcomePattern, '');

// 4. Change return ( to const appLayout = (
const returnPattern = /  return \(\n    <div className="app-layout">/;
content = content.replace(returnPattern, '  const appLayout = (\n    <div className="app-layout">');

// 5. Remove {showBusinessWizard} logic
content = content.replace(/      \{showBusinessWizard && <BusinessSetupWizard onComplete=\{\(\) => setShowBusinessWizard\(false\)\} \/>\}\n      \n      \{\!showBusinessWizard && \(\n        <>/, '');

// 6. Remove closing tags for showBusinessWizard
content = content.replace(/      <\/>\n      \)\}\n    <\/div>\n  \);/g, '    </div>\n  );');

// 7. Add Routes return at the end of App component
const newReturn = `
  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <Suspense fallback={<ViewLoading />}><Login onLoginSuccess={() => setIsAuthenticated(true)} /><ToastContainer /></Suspense> : <Navigate to="/app/dashboard" />} />
      <Route path="/register" element={!isAuthenticated ? <Suspense fallback={<ViewLoading />}><Login onLoginSuccess={() => setIsAuthenticated(true)} /><ToastContainer /></Suspense> : <Navigate to="/app/dashboard" />} />
      <Route path="/onboarding" element={isAuthenticated && showWelcome ? <><WelcomeGuide onComplete={(p) => { if(p) setProfile(p); setShowWelcome(false); }} /><ToastContainer /><ConfirmModalContainer /></> : <Navigate to="/app/dashboard" />} />
      <Route path="/setup-business" element={isAuthenticated && showBusinessWizard ? <BusinessSetupWizard onComplete={() => setShowBusinessWizard(false)} /> : <Navigate to="/app/dashboard" />} />
      <Route path="/app/*" element={
        isAuthenticated ? (
          showWelcome ? <Navigate to="/onboarding" /> :
          showBusinessWizard ? <Navigate to="/setup-business" /> :
          appLayout
        ) : <Navigate to="/login" />
      } />
      <Route path="*" element={<Navigate to={isAuthenticated ? "/app/dashboard" : "/login"} />} />
    </Routes>
  );
}

export default App;`;

content = content.replace(/  \);\n\}\n\nexport default App;/g, newReturn);

fs.writeFileSync('src/App.jsx', content);

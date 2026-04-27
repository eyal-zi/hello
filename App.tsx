import React from 'react';
import { CssBaseline, ThemeProvider, createTheme, Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import ImageSearch from './components/ImageSearch';

const theme = createTheme({
  palette: { mode: 'light' },
});

const AppRoot = styled(Box)({
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppRoot>
        <ImageSearch
          uploadUrl="https://httpbin.org/post"
          fieldName="image"
          onUploadSuccess={(data) => console.log('success', data)}
          onUploadError={(err) => console.error('error', err)}
        />
      </AppRoot>
    </ThemeProvider>
  );
};

export default App;

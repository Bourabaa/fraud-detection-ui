import { render, screen } from '@testing-library/react';
import App from './App';

test('renders fraud detection interface', () => {
  render(<App />);
  const titleElement = screen.getByText(/Credit Card Fraud Detection/i);
  expect(titleElement).toBeInTheDocument();
});

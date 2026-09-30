import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// StrictMode는 뺐어요: 개발 모드에서 실시간 채널을 두 번 열었다 닫으면서 방장이 바뀌는 걸 막기 위해
createRoot(document.getElementById('root')!).render(<App />)

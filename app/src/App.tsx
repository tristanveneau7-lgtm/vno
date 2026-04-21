import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Screen1Vertical } from './routes/Screen1Vertical'
import { Screen2Business } from './routes/Screen2Business'
import { Screen3Sections } from './routes/Screen3Sections'
import { Screen4Reference } from './routes/Screen4Reference'
import { Screen5Assets } from './routes/Screen5Assets'
import { Screen6Special } from './routes/Screen6Special'
import { Screen7Build } from './routes/Screen7Build'
import { Review } from './routes/Review'
import { DndCheck } from './routes/DndCheck'
import { Preview } from './routes/Preview'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/quiz/1" replace />} />
        <Route path="/quiz/1" element={<Screen1Vertical />} />
        <Route path="/quiz/2" element={<Screen2Business />} />
        <Route path="/quiz/3" element={<Screen3Sections />} />
        <Route path="/quiz/4" element={<Screen4Reference />} />
        <Route path="/quiz/5" element={<Screen5Assets />} />
        <Route path="/quiz/6" element={<Screen6Special />} />
        <Route path="/quiz/7" element={<Screen7Build />} />
        <Route path="/review" element={<Review />} />
        <Route path="/dnd" element={<DndCheck />} />
        <Route path="/preview" element={<Preview />} />
      </Routes>
    </BrowserRouter>
  )
}

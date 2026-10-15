import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { BrowserRouter, Link, Navigate, Route, Routes, useParams } from 'react-router'
import { CenteredMessage } from './components/CenteredMessage'
import { HomePage } from './home/HomePage'

// Students never download the teacher dashboard and vice versa.
const StudentPage = lazy(() => import('./student/StudentPage').then((m) => ({ default: m.StudentPage })))
const TeacherPage = lazy(() => import('./teacher/TeacherPage').then((m) => ({ default: m.TeacherPage })))
const GuidePage = lazy(() => import('./guide/GuidePage').then((m) => ({ default: m.GuidePage })))

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/c/:classId" element={<StudentPage />} />
          <Route path="/teacher/*" element={<TeacherPage />} />
          <Route path="/t/:key" element={<PersonalLink />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

/**
 * A teacher's personal link. The key moves into router state and the address bar shows plain
 * /teacher, so the secret never stays visible (dashboards are often projected).
 */
function PersonalLink() {
  const { key = '' } = useParams()
  return <Navigate to="/teacher" replace state={{ accessKey: key.toUpperCase() }} />
}

function Loading() {
  const { t } = useTranslation()
  return <CenteredMessage>{t('common.loading')}</CenteredMessage>
}

function NotFound() {
  const { t } = useTranslation()
  return (
    <CenteredMessage>
      <p>{t('common.notFound')}</p>
      <Link to="/">{t('common.backHome')}</Link>
    </CenteredMessage>
  )
}

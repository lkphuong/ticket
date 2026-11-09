import { useState } from 'react'
import { AuthLayout } from '../components/auth/AuthLayout.tsx'
import { readInitialAuthMode } from '../components/auth/authMode.ts'
import type { AuthMode } from '../components/auth/authMode.ts'
import { LoginForm } from '../components/auth/LoginForm.tsx'
import { RegisterForm } from '../components/auth/RegisterForm.tsx'
import type { RegisteredAccount } from '../components/auth/RegisterForm.tsx'
import { VerifyEmailForm } from '../components/auth/VerifyEmailForm.tsx'

interface VerificationTarget {
  readonly identifier: string
  readonly email: string
  readonly codeJustSent: boolean
}

const OPEN_VERIFICATION: VerificationTarget = { identifier: '', email: '', codeJustSent: false }

// Switches between sign in, registration and email verification; each step owns its own form state
export function LoginPage() {
  const [mode, setMode] = useState<AuthMode>(() => readInitialAuthMode(window.location.search))
  const [verification, setVerification] = useState<VerificationTarget>(OPEN_VERIFICATION)
  const [signInUsername, setSignInUsername] = useState('')

  function openVerification(target: VerificationTarget) {
    setVerification(target)
    setMode('verify')
  }

  function handleRegistered(account: RegisteredAccount) {
    openVerification({ identifier: account.username, email: account.email, codeJustSent: true })
  }

  function handleVerified(username: string) {
    setSignInUsername(username)
    setMode('login')
  }

  return (
    <AuthLayout mode={mode} onModeChange={setMode}>
      {mode === 'login' && (
        <LoginForm
          key={signInUsername}
          defaultUsername={signInUsername}
          onNeedVerification={(username) => openVerification({ ...OPEN_VERIFICATION, identifier: username })}
          onOpenRegister={() => setMode('register')}
          onOpenVerify={() => openVerification(OPEN_VERIFICATION)}
        />
      )}
      {mode === 'register' && <RegisterForm onRegistered={handleRegistered} onOpenLogin={() => setMode('login')} />}
      {mode === 'verify' && (
        <VerifyEmailForm
          knownIdentifier={verification.identifier}
          email={verification.email}
          codeJustSent={verification.codeJustSent}
          onVerified={handleVerified}
          onBackToLogin={() => setMode('login')}
        />
      )}
    </AuthLayout>
  )
}

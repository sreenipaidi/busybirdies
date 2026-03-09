import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { useAuth } from '../hooks/useAuth.js';
import { ApiError } from '../api/client.js';

const loginSchema = z.object({
  portal: z.string().min(1, 'Portal subdomain is required.'),
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const sessionExpired = searchParams.get('expired') === 'true';

  const {
    register,
    handleSubmit,
    formState: { errors },
    setFocus,
    setValue,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { portal: '', email: '', password: '' },
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      await login(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('An unexpected error occurred. Please try again.');
      }
      setValue('password', '');
      setFocus('password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Welcome to BusyBirdies</h1>
        <p className="text-sm text-text-secondary mt-1">Sign in to your account</p>
      </div>

      {sessionExpired && (
        <div
          className="mb-4 p-3 bg-warning-light border border-warning/20 text-warning text-sm rounded-md"
          role="alert"
        >
          Your session has expired. Please sign in again.
        </div>
      )}

      {serverError && (
        <div
          className="mb-4 p-3 bg-danger-light border border-danger/20 text-danger text-sm rounded-md"
          role="alert"
        >
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Input
          label="Portal subdomain"
          type="text"
          placeholder="acme"
          helperText="The subdomain you chose when registering."
          error={errors.portal?.message}
          disabled={isSubmitting}
          {...register('portal', {
            onChange: () => setServerError(null),
          })}
        />

        <Input
          label="Email address"
          type="email"
          placeholder="agent@company.com"
          autoComplete="email"
          error={errors.email?.message}
          disabled={isSubmitting}
          {...register('email', {
            onChange: () => setServerError(null),
          })}
        />

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="password" className="block text-sm font-medium text-text-primary">
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-xs text-primary hover:text-primary-hover"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            error={errors.password?.message}
            disabled={isSubmitting}
            {...register('password', {
              onChange: () => setServerError(null),
            })}
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isSubmitting}
          disabled={isSubmitting}
          className="w-full"
        >
          Sign In
        </Button>
      </form>

      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-surface px-2 text-text-secondary">or continue with</span>
          </div>
        </div>

        <Button
          variant="secondary"
          size="lg"
          className="w-full mt-4"
          onClick={() => {
            // Google SSO - placeholder
          }}
          disabled={isSubmitting}
        >
          <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Sign in with Google
        </Button>
      </div>

      <p className="mt-6 text-center text-sm text-text-secondary">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="text-primary hover:text-primary-hover font-medium">
          Register
        </Link>
      </p>
    </div>
  );
}


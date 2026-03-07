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

export function PortalLoginPage() {
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
        <h1 className="text-2xl font-bold text-text-primary">Client Portal</h1>
        <p className="text-sm text-text-secondary mt-1">
          Sign in to view and manage your support tickets
        </p>
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
          helperText="The subdomain of your company's support portal."
          error={errors.portal?.message}
          disabled={isSubmitting}
          {...register('portal', {
            onChange: () => setServerError(null),
          })}
        />

        <Input
          label="Email address"
          type="email"
          placeholder="you@company.com"
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
          Sign In to Portal
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-text-secondary">
        Don&apos;t have an account?{' '}
        <Link to="/portal-register" className="text-primary hover:text-primary-hover font-medium">
          Register
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-text-secondary">
        Are you an agent?{' '}
        <Link to="/login" className="text-primary hover:text-primary-hover font-medium">
          Agent login
        </Link>
      </p>
    </div>
  );
}

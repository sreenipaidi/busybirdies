import { useState } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { useAuth } from '../hooks/useAuth.js';
import { ApiError } from '../api/client.js';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  portal: z.string().min(1, 'Portal subdomain is required.'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '', portal: '' },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      await forgotPassword(data.email, data.portal);
      setIsSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="text-center">
        <div className="mb-4">
          <svg
            className="h-12 w-12 text-success mx-auto"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">Check your email</h1>
        <p className="text-sm text-text-secondary mb-6">
          If an account exists with that email address, we have sent password reset instructions.
        </p>
        <Link
          to="/login"
          className="text-primary hover:text-primary-hover text-sm font-medium"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Forgot your password?</h1>
        <p className="text-sm text-text-secondary mt-1">
          Enter your email and we will send you a reset link.
        </p>
      </div>

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
          label="Email address"
          type="email"
          placeholder="your@email.com"
          autoComplete="email"
          error={errors.email?.message}
          disabled={isSubmitting}
          {...register('email')}
        />

        <Input
          label="Portal subdomain"
          type="text"
          placeholder="e.g. acme"
          error={errors.portal?.message}
          disabled={isSubmitting}
          {...register('portal')}
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isSubmitting}
          disabled={isSubmitting}
          className="w-full"
        >
          Send Reset Link
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-text-secondary">
        <Link to="/login" className="text-primary hover:text-primary-hover font-medium">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

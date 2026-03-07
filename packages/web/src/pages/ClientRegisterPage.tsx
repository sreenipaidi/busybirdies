import { useState } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { useAuth } from '../hooks/useAuth.js';
import { ApiError } from '../api/client.js';

const clientRegisterSchema = z.object({
  portal: z.string().min(1, 'Portal subdomain is required.'),
  full_name: z.string().min(1, 'Full name is required.').max(100),
  email: z.string().email('Please enter a valid email address.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(128),
});

type ClientRegisterFormData = z.infer<typeof clientRegisterSchema>;

export function ClientRegisterPage() {
  const { register: registerClient } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClientRegisterFormData>({
    resolver: zodResolver(clientRegisterSchema),
    defaultValues: {
      portal: '',
      full_name: '',
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: ClientRegisterFormData) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      await registerClient(data);
      setSuccess(true);
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

  if (success) {
    return (
      <div className="text-center">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-success/10 mb-4">
          <svg className="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-text-primary mb-2">Registration Successful!</h2>
        <p className="text-sm text-text-secondary mb-6">
          Your account has been created. Please check your email to verify your account before signing in.
        </p>
        <Link
          to="/portal-login"
          className="text-primary hover:text-primary-hover font-medium text-sm"
        >
          Go to Portal Login
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Create a Client Account</h1>
        <p className="text-sm text-text-secondary mt-1">
          Register to submit and track your support tickets
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
          label="Portal subdomain"
          type="text"
          placeholder="acme"
          helperText="The subdomain of your company's support portal."
          error={errors.portal?.message}
          disabled={isSubmitting}
          {...register('portal')}
        />

        <Input
          label="Full name"
          type="text"
          placeholder="Jane Smith"
          autoComplete="name"
          error={errors.full_name?.message}
          disabled={isSubmitting}
          {...register('full_name')}
        />

        <Input
          label="Email address"
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
          error={errors.email?.message}
          disabled={isSubmitting}
          {...register('email')}
        />

        <Input
          label="Password"
          type="password"
          placeholder="At least 8 characters"
          autoComplete="new-password"
          error={errors.password?.message}
          helperText="Must be at least 8 characters."
          disabled={isSubmitting}
          {...register('password')}
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isSubmitting}
          disabled={isSubmitting}
          className="w-full"
        >
          Create Account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-text-secondary">
        Already have an account?{' '}
        <Link to="/portal-login" className="text-primary hover:text-primary-hover font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}

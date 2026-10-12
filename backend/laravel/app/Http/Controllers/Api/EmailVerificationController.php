<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Foundation\Auth\EmailVerificationRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class EmailVerificationController extends Controller
{
    public function notice(Request $request)
    {
        $verified = $request->user()->hasVerifiedEmail();

        if ($request->expectsJson()) {
            return response()->json([
                'message' => $verified
                    ? 'Your email is already verified.'
                    : 'Please verify your email address.',
                'email_verified' => $verified,
            ]);
        }

        $frontendUrl = rtrim(config('app.frontend_url'), '/');

        return redirect()->away(
            $frontendUrl.'/verify-email'
            .($verified ? '?status=verified' : '')
        );
    }

    public function verify(EmailVerificationRequest $request)
    {
        $alreadyVerified = $request->user()->hasVerifiedEmail();

        $request->fulfill();

        if ($request->expectsJson()) {
            return response()->json([
                'message' => $alreadyVerified
                    ? 'Your email is already verified.'
                    : 'Email verified successfully.',
                'email_verified' => true,
                'user' => $request->user()->load(['role', 'profile']),
            ]);
        }

        return redirect()->away(
            rtrim(config('app.frontend_url'), '/')
            .'/verify-email?status=verified'
        );
    }

    public function resend(Request $request)
    {
        $user = $request->user();

        if ($user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Your email is already verified.',
                'email_verified' => true,
                'verification_email_sent' => false,
            ]);
        }

        try {
            $user->sendEmailVerificationNotification();
        } catch (\Throwable $exception) {
            Log::warning('Verification notification resend failed.', [
                'user_id' => $user->id,
                'exception_class' => $exception::class,
            ]);

            return response()->json([
                'message' => 'The verification email could not be sent. Please try again later.',
                'email_verified' => false,
                'verification_email_sent' => false,
            ], 503);
        }

        return response()->json([
            'message' => 'Verification email sent.',
            'email_verified' => false,
            'verification_email_sent' => true,
        ]);
    }
}
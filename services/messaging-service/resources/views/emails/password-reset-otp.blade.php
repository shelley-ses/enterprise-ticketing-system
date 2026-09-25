<!doctype html>
<html>
<body style="font-family: Arial, sans-serif; background: #f7f7f7; color: #111827; padding: 24px;">
    <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e5e7eb;">
        <h1 style="margin: 0 0 16px; font-size: 24px;">Password Reset Code</h1>
        <p style="margin: 0 0 16px; line-height: 1.6;">Hello {{ $client->client_name }},</p>
        <p style="margin: 0 0 20px; line-height: 1.6;">Use this 6-digit code to reset your password:</p>
        <div style="font-size: 32px; letter-spacing: 6px; font-weight: 700; background: #f3f4f6; padding: 16px 20px; border-radius: 10px; text-align: center; margin: 0 0 20px;">{{ $otp }}</div>
        <p style="margin: 0 0 12px; line-height: 1.6;">This code expires in {{ $expiresMinutes }} minutes.</p>
        <p style="margin: 0; line-height: 1.6; color: #6b7280;">If you did not request this, you can ignore this email.</p>
    </div>
</body>
</html>
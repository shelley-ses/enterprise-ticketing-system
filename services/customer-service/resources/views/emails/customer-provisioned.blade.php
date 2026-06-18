<!doctype html>
<html>
<body style="font-family: Arial, sans-serif; background: #f7f7f7; color: #111827; padding: 24px;">
    <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e5e7eb;">
        <h1 style="margin: 0 0 16px; font-size: 24px;">Your Account has been Provisioned</h1>
        <p style="margin: 0 0 16px; line-height: 1.6;">Hello {{ $client->client_name }},</p>
        <p style="margin: 0 0 16px; line-height: 1.6;">Your account on the Enterprise Ticketing System has been successfully created. You can log in using the following details:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
                <td style="padding: 8px 0; font-weight: bold; width: 120px;">Email / Username:</td>
                <td style="padding: 8px 0; color: #3b82f6;">{{ $client->email }}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; font-weight: bold;">Temporary Password:</td>
                <td style="padding: 8px 0; font-family: monospace; font-size: 16px; background: #f3f4f6; padding-left: 8px; border-radius: 4px;">{{ $temporaryPassword }}</td>
            </tr>
        </table>

        <p style="margin: 0 0 20px; line-height: 1.6; color: #ef4444; font-weight: bold;">Note: You will be prompted to verify your account with an OTP code and change your password upon your first login.</p>
        
        <p style="margin: 0; line-height: 1.6; color: #6b7280;">If you did not expect this, please contact our support team.</p>
    </div>
</body>
</html>

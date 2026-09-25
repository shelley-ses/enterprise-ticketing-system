<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: #fff; padding: 20px; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 20px; }
        .body { background: #fff; padding: 20px; border: 1px solid #e5e7eb; }
        .details { background: #f9fafb; padding: 15px; border-radius: 6px; margin: 15px 0; }
        .details table { width: 100%; border-collapse: collapse; }
        .details td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
        .details td:first-child { font-weight: 600; width: 120px; color: #6b7280; }
        .btn { display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; margin-top: 15px; font-weight: 600; }
        .footer { margin-top: 20px; font-size: 12px; color: #9ca3af; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{ $notificationTitle }}</h1>
        </div>
        <div class="body">
            <p>{{ $notificationMessage }}</p>

            <div class="details">
                <table>
                    <tr><td>Ticket</td><td>{{ $ticketRef }}</td></tr>
                    <tr><td>Title</td><td>{{ $ticketTitle }}</td></tr>
                    <tr><td>Category</td><td>{{ $category }}</td></tr>
                    <tr><td>Priority</td><td>{{ $priority }}</td></tr>
                </table>
            </div>

            <a href="{{ $ticketLink }}" class="btn" target="_blank">View Ticket Details</a>
        </div>
        <div class="footer">
            <p>This is an automated notification from the Enterprise Ticketing System.</p>
        </div>
    </div>
</body>
</html>

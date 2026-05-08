const RESEND_API_KEY = process.env.EXPO_PUBLIC_RESEND_API_KEY || '';

export const sendOTPEmail = async (email: string, otp: string) => {
    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: 'RideHub <no-reply@promptify.fun>',
                to: [email],
                subject: 'Your RideHub Verification Code',
                html: `
                    <div style="font-family: sans-serif; padding: 20px; color: #333;">
                        <h2 style="color: #2563EB;">RideHub Verification</h2>
                        <p>Hi there,</p>
                        <p>Your verification code for RideHub is:</p>
                        <div style="background: #F3F4F6; padding: 15px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center; margin: 20px 0;">
                            ${otp}
                        </div>
                        <p>This code will expire in 10 minutes. If you didn't request this code, please ignore this email.</p>
                        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;" />
                        <p style="font-size: 12px; color: #6B7280;">RideHub - Centralized Transport Finder</p>
                    </div>
                `,
            }),
        });

        const data = await response.json();
        if (response.ok) {
            return { success: true, id: data.id };
        } else {
            return { success: false, error: data.message || 'Failed to send email' };
        }
    } catch (error) {
        return { success: false, error: 'Network error or invalid configuration' };
    }
};

export const generateOTP = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

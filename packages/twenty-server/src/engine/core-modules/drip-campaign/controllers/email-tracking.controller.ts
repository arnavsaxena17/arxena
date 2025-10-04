import { Body, Controller, Get, Headers, Param, Post, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { EmailTrackingPixelService } from '../services/email-tracking-pixel.service';

@Controller('drip-campaigns/tracking')
export class EmailTrackingController {
  constructor(
    private readonly emailTrackingPixelService: EmailTrackingPixelService,
  ) {}

  @Get('pixel/:pixelId')
  async handlePixelTracking(
    @Param('pixelId') pixelId: string,
    @Req() req: Request,
    @Res() res: Response,
    @Headers('user-agent') userAgent?: string,
  ) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress;
      
      await this.emailTrackingPixelService.handlePixelTracking(
        pixelId,
        userAgent,
        ipAddress,
      );

      // Return a 1x1 transparent pixel
      const pixel = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'base64'
      );

      res.set({
        'Content-Type': 'image/png',
        'Content-Length': pixel.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      });

      res.send(pixel);
    } catch (error) {
      console.error('Error handling pixel tracking:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  @Get('click/:pixelId')
  async handleClickTracking(
    @Param('pixelId') pixelId: string,
    @Res() res: Response,
    @Query('url') clickUrl?: string,
  ) {
    try {
      await this.emailTrackingPixelService.handleClickTracking(pixelId, clickUrl);

      // Redirect to the clicked URL or a default page
      const redirectUrl = clickUrl || process.env.DEFAULT_REDIRECT_URL || 'https://example.com';
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('Error handling click tracking:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  @Post('reply/:replyId')
  async handleReplyTracking(
    @Param('replyId') replyId: string,
    @Body() body: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      await this.emailTrackingPixelService.handleReplyTracking(
        replyId,
        body.content || body.text || '',
      );

      res.status(200).json({ message: 'Reply tracked successfully' });
    } catch (error) {
      console.error('Error handling reply tracking:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  @Post('bounce')
  async handleBounceTracking(
    @Body() body: { email: string; reason?: string },
    @Res() res: Response,
  ) {
    try {
      await this.emailTrackingPixelService.handleBounceTracking(
        body.email,
        body.reason,
      );

      res.status(200).json({ message: 'Bounce tracked successfully' });
    } catch (error) {
      console.error('Error handling bounce tracking:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  @Post('unsubscribe')
  async handleUnsubscribeTracking(
    @Body() body: { email: string; campaignId?: string },
    @Res() res: Response,
  ) {
    try {
      await this.emailTrackingPixelService.handleUnsubscribeTracking(
        body.email,
        body.campaignId,
      );

      res.status(200).json({ message: 'Unsubscribe tracked successfully' });
    } catch (error) {
      console.error('Error handling unsubscribe tracking:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  @Get('unsubscribe/:email')
  async handleUnsubscribePage(
    @Param('email') email: string,
    @Res() res: Response,
    @Query('campaignId') campaignId?: string,
  ) {
    try {
      await this.emailTrackingPixelService.handleUnsubscribeTracking(email, campaignId);

      // Return an unsubscribe confirmation page
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Unsubscribed</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .container { max-width: 500px; margin: 0 auto; }
            .success { color: #28a745; font-size: 24px; margin-bottom: 20px; }
            .message { color: #666; font-size: 16px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success">✓ Unsubscribed Successfully</div>
            <div class="message">
              You have been unsubscribed from our email campaigns.
              <br><br>
              Email: ${email}
              ${campaignId ? `<br>Campaign: ${campaignId}` : ''}
            </div>
          </div>
        </body>
        </html>
      `;

      res.set('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      console.error('Error handling unsubscribe page:', error);
      res.status(500).send('Internal Server Error');
    }
  }
}

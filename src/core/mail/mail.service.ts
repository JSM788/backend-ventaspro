import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor() {
    this.initTransporter();
  }

  private async initTransporter() {
    if (process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      this.logger.log('Transporter SMTP inicializado con credenciales de producción/env.');
    } else {
      // Para entornos locales sin credenciales, creamos una cuenta de prueba en Ethereal
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: testAccount.user, // generated ethereal user
          pass: testAccount.pass, // generated ethereal password
        },
      });
      this.logger.log('Transporter de prueba (Ethereal) inicializado.');
    }
  }

  async sendWelcomeEmail(to: string, subject: string, htmlContent: string) {
    if (!this.transporter) {
      await this.initTransporter();
    }

    const info = await this.transporter.sendMail({
      from: '"VentasPro SaaS" <no-reply@ventaspro.com>',
      to,
      subject,
      html: htmlContent,
    });

    this.logger.log(`Mensaje enviado: ${info.messageId}`);
    
    // Ethereal nos da una URL pública para previsualizar el correo enviado
    if (!process.env.SMTP_HOST) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      this.logger.log(`📬 PREVISUALIZAR CORREO REAL: ${previewUrl}`);
      console.log(`\n=======================================================`);
      console.log(`📬 EL CORREO HA LLEGADO AL BUZÓN DE PRUEBA.`);
      console.log(`Abre este enlace para verlo: ${previewUrl}`);
      console.log(`=======================================================\n`);
    }

    return info;
  }
}

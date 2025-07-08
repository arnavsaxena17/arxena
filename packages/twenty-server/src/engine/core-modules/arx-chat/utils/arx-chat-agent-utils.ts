import fs from 'fs';
import path from 'path';

import ffmpeg from 'fluent-ffmpeg';
import OpenAI from 'openai';
import { CandidateNode } from 'twenty-shared';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export function sortWhatsAppMessages (candidates  : CandidateNode[]) {
  const sortedCandidates: CandidateNode[] = candidates;
  sortedCandidates?.forEach((candidate) => {
    candidate?.whatsappMessages?.edges.sort((a, b) => {
        return (
          new Date(b.node.createdAt).getTime() -
          new Date(a.node.createdAt).getTime()
      );
    });
  });
  console.log(
    'Total candidates have been sorted by the latest WhatsApp message::',
    sortedCandidates.length,
  );

  return sortedCandidates;
}

export function getContentTypeFromFileName(filename: string) {
  const extension = filename?.split('.').pop()?.toLowerCase() ?? '';
  let contentType;

  switch (extension) {
    case 'doc':
      contentType = 'application/msword';
      break;
    case 'docx':
      contentType =
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      break;
    case 'pdf':
      contentType = 'application/pdf';
      break;
    default:
      contentType = 'application/octet-stream'; // Default content type if none match
  }

  return contentType;
}

export async function formatChat(messages) {
  console.log('Formatting chat');

  let formattedChat = '';
  let messageCount = 1;

  [...messages].reverse().forEach((message) => {
    const timestamp = new Date(message.createdAt).toLocaleString();
    let sender = '';

    if (message.name === 'candidateMessage') {
      sender = 'Candidate';
    } else if (
      message.name === 'botMessage' ||
      message.name === 'recruiterMessage'
    ) {
      sender = 'Recruiter';
    } else {
      sender = message.name;
    }

    formattedChat += `[${timestamp}] ${sender}:\n`;
    formattedChat += `${message.message}\n\n`;
    messageCount++;
  });

  return formattedChat;
}

async function convertOggToWav(inputFilePath: string) {
  const outputFilePath = inputFilePath.replace('.ogg', '.wav');

  return new Promise((resolve, reject) => {
    ffmpeg(inputFilePath)
      .toFormat('wav')
      .on('end', () => {
        console.log('Conversion complete:', outputFilePath);
        resolve(outputFilePath);
      })
      .on('error', (err) => {
        console.error('Error during conversion:', err);
        reject(err);
      })
      .save(outputFilePath);
  });
}

export async function getTranscriptionFromWhisper(
  filePath: string,
): Promise<string> {
  const inputFilePath = path.resolve(filePath);
  const outputFilePath = inputFilePath.replace('.ogg', '.wav');

  await convertOggToWav(inputFilePath)
    .then(() => {
      console.log('File converted successfully');
    })
    .catch((err) => {
      console.error('Error converting file:', err);
    });

  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(outputFilePath),
    model: 'whisper-1',
  });

  console.log(transcription.text);

  return transcription?.text;
}

export function toIsoString(date: Date) {
  const tzo = -date.getTimezoneOffset();
  const dif = tzo >= 0 ? '+' : '-';

  function pad(num: number): string {
    return (num < 10 ? '0' : '') + num;
  }

  return (
    date.getFullYear() +
    '-' +
    pad(date.getMonth() + 1) +
    '-' +
    pad(date.getDate()) +
    'T' +
    pad(date.getHours()) +
    ':' +
    pad(date.getMinutes()) +
    ':' +
    pad(date.getSeconds()) +
    dif +
    pad(Math.floor(Math.abs(tzo) / 60)) +
    ':' +
    pad(Math.abs(tzo) % 60)
  );
}

export function addHoursInDate(date: Date, hours: number) {
  date.setHours(date.getHours() + hours);

  return date;
}

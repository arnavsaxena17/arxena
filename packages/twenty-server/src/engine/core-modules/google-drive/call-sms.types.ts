export interface PhoneCall {
    id: string;
    personId: string;
    phoneNumber: string; 
    callType: 'INCOMING' | 'OUTGOING' | 'MISSED' | 'REJECTED';
    duration: number;
    timestamp: Date;
    recordingAttachmentId?: string;
}
   
export interface SMS {
    id: string;
    personId: string;
    phoneNumber: string;
    messageType: 'INCOMING' | 'OUTGOING';
    message: string;
    timestamp: Date;
}
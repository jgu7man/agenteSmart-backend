export interface Event {
	object: "page";
	entry: Entry[];
}

export interface Entry {
	id: string;
	time: number;
	messaging: MessageBody[];
}

export interface MessageBody {
	sender: Sender
	recipient: Recipient
    timestamp: number;
    message: Message
}
export interface Sender {
    id: string,
    user_ref?:string
}
export interface Recipient {
    id: string
}
export interface Message {
	mid: string;
	text: string;
	quick_reply?: QuickReply
    reply_to?: ReplayTo
    attachments?: Attachment[],
    referral?: Referral
    time?: Date
}
export interface QuickReply {
    payload: string
}
export interface ReplayTo {
    mid: string
}
export interface Attachment {
    type: AttachmentType,
    payload: AttachmentPayload
}
export interface AttachmentPayload {
    url?: string,
    title?: string,
    sticker_id?: string,
    coordinates?: {
        lat?: number
        long?: number
    }
}
export interface Referral {
    product:Product
}
export interface Product {
    id:string
}
export type AttachmentType = 'image' | 'video' | 'audio' | 'file' | 'location' | 'fallback'

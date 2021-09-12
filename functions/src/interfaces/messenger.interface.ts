import { IntentResponse } from "./conversation.interface";
import { Message } from "./webhook.interface";

export interface ConversationItem {
	projectId: string;
	senderId: string;
	message: Message;
}

export interface iInteractionResult {
	page_access_token: string;
	intent_response: IntentResponse;
	active: boolean;
}

export interface QuickReply {
	content_type: "text" | "user_phone_number" | "user_email";
	title?: string;
	payload: any ;
	image_url?: string;
}

export interface LocationAttachment {
	title: string;
	url: string;
	type: "location";
	payload: {
		coordinates: {
			lat: number;
			long: number;
		};
	};
}

export interface TemplateCard {
	title: string;
	image_url: string;
	subtitle: string;
	default_action: {
		type: "web_url";
		url: string;
		messenger_extensions: boolean;
		webview_height_ratio: "COMPACT" | "TALL" | "FULL";
	};
	buttons: TemplateButton[];
}

export interface TemplateButton {
	type: "web_url" | "postback";
	title: string;
    url?: string;
    payload?: any
}
import { google } from '@google-cloud/dialogflow/build/protos/protos';

export interface Project{
    displayName: string;
    projectId: string;
    parent: {
        id: string;
        type: string;
    };
};
export interface ProjectOptions {
    name: string;
    labels?: {[index: string]: string} | undefined;
};
export interface Agent extends google.cloud.dialogflow.v2.IAgent{
    parent?: string;
    displayName?:string;
    defaultLanguageCode?: string;
    timeZone?: string;
    avatarUri?: string;
    enableLoggin?: boolean;
    apiVersion?: any;
    tier?: any;
    description?: string;
    matchMode?: any;

};
export interface IPreProject {
    displayName: string;
    projectId: string;
}

export interface IParameter {
    name: string;
    displayName: string;
    value: string;
    defaultValue?: string;
    entityTypeDisplayName?: string;
    mandatory: boolean;
    prompts?: Array<string>;
    isList: boolean;
}

export type IType = "TYPE_UNSPECIFIED" | "EXAMPLE" | "TEMPLATE";

export interface IPart {
    text?: string;
    entityType?: string;
    alias?: string;
    userDefined?: boolean;
}
export interface ITrainingPhrase {
    name?: string;
    type: IType;
    parts: [IPart];
}

export type IntentView = "INTENT_VIEW_UNSPECIFIED" | "INTENT_VIEW_FULL";

export interface IIntent {
    name?: string;
    displayName: string;
    webHookState: number;
    trainingPhrases?: Array<ITrainingPhrase>;
    action?: string;
    parameters?: Array<IParameter>;
    messages?: Array<object>;
    isFallback?: boolean;
    events?: Array<string>;
    rootFollowupIntentName: string;
    parentFollowupIntentName: string;
    followupIntentInfo: [FollowupIntentInfo]
}

interface FollowupIntentInfo {
    followupIntentName: string;
    parentFollowupIntentName: string;
}

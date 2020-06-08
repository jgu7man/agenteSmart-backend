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

export interface IIntent {
    name?: string;
    displayName: string;
    webHookState: number;
    trainingPhrases: Array<ITrainingPhrase>;
    action?: string;
    parameters?: Array<IParameter>;
    messages?: Array<object>;
    isFallback?: boolean;
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

export interface ITrainingPhrase {
    name: string;
    type: number;
    parts: Array<IPart>;
}

export interface IPart {
    text: string;
    entityType: string;
    alias?: string;
    userDefine?: boolean;
}
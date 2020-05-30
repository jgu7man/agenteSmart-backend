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
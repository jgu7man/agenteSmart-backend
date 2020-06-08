export interface IEntityType {
 name: string;
 displayName: string;
 kind: number;
 autoExpansionMode?: number;
 entities?: Array<IEntity>;   
}

export interface IEntity {
    value: string;
    //For KIND_LIST entity types 
    //this must contain exactly one synonym equal to value.
    synonyms: Array<string>;
}

export interface IEntityCreateReq {
    entityType: ICreateEntityType;
    parent: string;
    languageCode?: string;

}
export interface IListEntityTypes {
    parent: string;
    languageCode?: string;
    pageSize?: number;
    pageToken?: string;
}

export interface IEntity {
    value: string;
    synonyms: Array<string>;
}

export interface ICreateEntityType {
    displayName: string;
    kind: number;
    autoExpansionMOde?: number;
    entities: Array<IEntity>;
}
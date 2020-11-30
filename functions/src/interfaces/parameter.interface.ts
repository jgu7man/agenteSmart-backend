export interface SysDateTime {
	date_time: Date;
}

export interface SysDatePeriod {
	startDate: Date;
	endDate: Date;
}

export interface SysTimePeriod {
	startTime: Date;
	endTime: Date;
}

export interface SysDateTimePeriod {
	startDateTime: Date;
	endDateTime: Date;
}

export interface SysUnitCurrency {
	amount: number;
	currency: string;
}

export interface SysDuration {
	amount: number;
	unit: string;
}

export interface SysLocation {
	"admin-area": string;
	"business-name": string;
	city: string;
	country: string;
	island: string;
	shortcut: string;
	"street-address": string;
	"subadmin-area": string;
	"zip-code": string;
}

export interface SysPerson {
	name: string;
}

export interface ResultParam {
	type: SystemType;
	value: any;
}

export interface IntentDetectedParam {
	[key: string]: {
		[typeValue: string]: any;
		kind: string;
	};
}

export type SysInterface =
	| SysDateTime
	| SysDatePeriod
	| SysTimePeriod
	| SysDateTimePeriod
	| SysUnitCurrency
	| SysDuration
	| SysLocation
	| SysPerson;

export type SystemType =
	| "datetime"
	| "dateperiod"
	| "timeperiod"
	| "datetimeperoid"
	| "unitcurrency"
	| "duration"
	| "location"
	| "person"

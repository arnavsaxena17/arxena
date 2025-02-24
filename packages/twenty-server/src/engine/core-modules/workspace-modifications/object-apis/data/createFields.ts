// Helper functions to create different field types

import { TextField, NumberField, BooleanField, DateTimeField, SelectField, LinkField, RawJsonField } from "twenty-shared";


export class CreateFieldsOnObject {

    createTextField(params: Omit<TextField, 'type'>): TextField {
        return {
            ...params,
            type: 'TEXT'
        };
    }
    
    createNumberField(params: Omit<NumberField, 'type'>): NumberField {
        return {
            ...params,
            type: 'NUMBER'
        };
    }
    
    createBooleanField(params: Omit<BooleanField, 'type'>): BooleanField {
        return {
            ...params,
            type: 'BOOLEAN'
        };
    }
    
    createDateTimeField(params: Omit<DateTimeField, 'type'>): DateTimeField {
        return {
            ...params,
            type: 'DATE_TIME'
        };
    }
    
    createSelectField(params: Omit<SelectField, 'type'>): SelectField {
        return {
            ...params,
            type: 'SELECT'
        };
    }
    
    createLinkField(params: Omit<LinkField, 'type'>): LinkField {
        return {
            ...params,
            type: 'LINKS'
        };
    }
    
    createRawJsonField(params: Omit<RawJsonField, 'type'>): RawJsonField {
        return {
            ...params,
            type: 'RAW_JSON'
        };
    }
    
}
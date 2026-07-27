export default {
    "scalars": [
        1,
        3,
        4,
        5,
        6,
        9,
        16,
        17,
        18,
        23,
        25,
        27,
        30,
        31,
        38,
        39,
        40,
        43,
        45,
        53,
        55,
        57,
        59,
        62,
        65,
        66,
        67,
        68,
        69,
        71,
        72,
        74,
        75,
        82,
        85,
        90,
        91,
        94,
        95,
        97,
        100,
        101,
        107,
        121,
        127,
        128,
        129,
        131,
        139,
        142,
        155,
        170,
        173,
        175,
        179,
        186,
        187,
        194,
        197,
        200,
        212,
        229,
        242,
        248,
        282,
        291,
        292,
        293,
        294,
        295,
        296,
        297,
        304,
        337,
        339,
        340,
        341,
        342,
        344,
        346,
        358,
        365,
        372,
        373,
        505
    ],
    "types": {
        "BillingProductDTO": {
            "name": [
                1
            ],
            "description": [
                1
            ],
            "images": [
                1
            ],
            "metadata": [
                126
            ],
            "on_BillingLicensedProduct": [
                135
            ],
            "on_BillingMeteredProduct": [
                136
            ],
            "__typename": [
                1
            ]
        },
        "String": {},
        "ApplicationRegistrationVariable": {
            "id": [
                4
            ],
            "key": [
                1
            ],
            "description": [
                1
            ],
            "isSecret": [
                3
            ],
            "isRequired": [
                3
            ],
            "type": [
                1
            ],
            "options": [
                5
            ],
            "isFilled": [
                3
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "__typename": [
                1
            ]
        },
        "Boolean": {},
        "UUID": {},
        "JSON": {},
        "DateTime": {},
        "ApiKey": {
            "id": [
                4
            ],
            "name": [
                1
            ],
            "expiresAt": [
                6
            ],
            "revokedAt": [
                6
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "role": [
                49
            ],
            "__typename": [
                1
            ]
        },
        "ApplicationRegistrationSummary": {
            "id": [
                4
            ],
            "latestAvailableVersion": [
                1
            ],
            "sourceType": [
                9
            ],
            "logoUrl": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "ApplicationRegistrationSourceType": {},
        "ApplicationVariable": {
            "id": [
                4
            ],
            "key": [
                1
            ],
            "value": [
                1
            ],
            "description": [
                1
            ],
            "isSecret": [
                3
            ],
            "type": [
                1
            ],
            "options": [
                5
            ],
            "__typename": [
                1
            ]
        },
        "Agent": {
            "id": [
                4
            ],
            "name": [
                1
            ],
            "label": [
                1
            ],
            "icon": [
                1
            ],
            "description": [
                1
            ],
            "prompt": [
                1
            ],
            "modelId": [
                1
            ],
            "responseFormat": [
                5
            ],
            "roleId": [
                4
            ],
            "isCustom": [
                3
            ],
            "applicationId": [
                4
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "modelConfiguration": [
                5
            ],
            "evaluationInputs": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "AuthToken": {
            "token": [
                1
            ],
            "expiresAt": [
                6
            ],
            "__typename": [
                1
            ]
        },
        "ApplicationTokenPair": {
            "applicationAccessToken": [
                12
            ],
            "applicationRefreshToken": [
                12
            ],
            "__typename": [
                1
            ]
        },
        "FrontComponent": {
            "id": [
                4
            ],
            "name": [
                1
            ],
            "description": [
                1
            ],
            "sourceComponentPath": [
                1
            ],
            "builtComponentPath": [
                1
            ],
            "componentName": [
                1
            ],
            "builtComponentChecksum": [
                1
            ],
            "universalIdentifier": [
                4
            ],
            "applicationId": [
                4
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "isHeadless": [
                3
            ],
            "usesSdkClient": [
                3
            ],
            "applicationTokenPair": [
                13
            ],
            "applicationVariables": [
                5
            ],
            "__typename": [
                1
            ]
        },
        "CommandMenuItem": {
            "id": [
                4
            ],
            "workflowVersionId": [
                4
            ],
            "frontComponentId": [
                4
            ],
            "frontComponent": [
                14
            ],
            "engineComponentKey": [
                17
            ],
            "label": [
                1
            ],
            "icon": [
                1
            ],
            "shortLabel": [
                1
            ],
            "position": [
                16
            ],
            "isPinned": [
                3
            ],
            "availabilityType": [
                18
            ],
            "payload": [
                19
            ],
            "hotKeys": [
                1
            ],
            "conditionalAvailabilityExpression": [
                1
            ],
            "availabilityObjectMetadataId": [
                4
            ],
            "pageLayoutId": [
                4
            ],
            "universalIdentifier": [
                4
            ],
            "applicationId": [
                4
            ],
            "isActive": [
                3
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "__typename": [
                1
            ]
        },
        "Float": {},
        "EngineComponentKey": {},
        "CommandMenuItemAvailabilityType": {},
        "CommandMenuItemPayload": {
            "on_PathCommandMenuItemPayload": [
                20
            ],
            "on_ObjectMetadataCommandMenuItemPayload": [
                21
            ],
            "__typename": [
                1
            ]
        },
        "PathCommandMenuItemPayload": {
            "path": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "ObjectMetadataCommandMenuItemPayload": {
            "objectMetadataItemId": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "LogicFunction": {
            "id": [
                4
            ],
            "name": [
                1
            ],
            "description": [
                1
            ],
            "runtime": [
                1
            ],
            "timeoutSeconds": [
                16
            ],
            "executionMode": [
                23
            ],
            "sourceHandlerPath": [
                1
            ],
            "handlerName": [
                1
            ],
            "cronTriggerSettings": [
                5
            ],
            "databaseEventTriggerSettings": [
                5
            ],
            "httpRouteTriggerSettings": [
                5
            ],
            "toolTriggerSettings": [
                5
            ],
            "workflowActionTriggerSettings": [
                5
            ],
            "applicationId": [
                4
            ],
            "universalIdentifier": [
                4
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "__typename": [
                1
            ]
        },
        "LogicFunctionExecutionMode": {},
        "Field": {
            "id": [
                4
            ],
            "universalIdentifier": [
                1
            ],
            "type": [
                25
            ],
            "name": [
                1
            ],
            "label": [
                1
            ],
            "description": [
                1
            ],
            "icon": [
                1
            ],
            "isActive": [
                3
            ],
            "isSystem": [
                3
            ],
            "isUIEditable": [
                3
            ],
            "isUIReadOnly": [
                3
            ],
            "isNullable": [
                3
            ],
            "isUnique": [
                3
            ],
            "defaultValue": [
                5
            ],
            "options": [
                5
            ],
            "settings": [
                5
            ],
            "objectMetadataId": [
                4
            ],
            "isLabelSyncedWithName": [
                3
            ],
            "morphId": [
                4
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "applicationId": [
                4
            ],
            "relation": [
                228
            ],
            "morphRelations": [
                228
            ],
            "object": [
                28
            ],
            "__typename": [
                1
            ]
        },
        "FieldMetadataType": {},
        "Index": {
            "id": [
                4
            ],
            "name": [
                1
            ],
            "isCustom": [
                3
            ],
            "isUnique": [
                3
            ],
            "indexWhereClause": [
                1
            ],
            "indexType": [
                27
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "indexFieldMetadataList": [
                230
            ],
            "__typename": [
                1
            ]
        },
        "IndexType": {},
        "Object": {
            "id": [
                4
            ],
            "universalIdentifier": [
                1
            ],
            "nameSingular": [
                1
            ],
            "namePlural": [
                1
            ],
            "labelSingular": [
                1
            ],
            "labelPlural": [
                1
            ],
            "description": [
                1
            ],
            "icon": [
                1
            ],
            "shortcut": [
                1
            ],
            "color": [
                1
            ],
            "isRemote": [
                3
            ],
            "isActive": [
                3
            ],
            "isSystem": [
                3
            ],
            "isUIEditable": [
                3
            ],
            "isUICreatable": [
                3
            ],
            "isUIReadOnly": [
                3
            ],
            "isSearchable": [
                3
            ],
            "applicationId": [
                4
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "labelIdentifierFieldMetadataId": [
                4
            ],
            "imageIdentifierFieldMetadataId": [
                4
            ],
            "isLabelSyncedWithName": [
                3
            ],
            "duplicateCriteria": [
                1
            ],
            "fieldsList": [
                24
            ],
            "indexMetadataList": [
                26
            ],
            "searchFieldMetadataList": [
                232
            ],
            "fields": [
                239,
                {
                    "paging": [
                        29,
                        "CursorPaging!"
                    ],
                    "filter": [
                        32,
                        "FieldFilter!"
                    ]
                }
            ],
            "indexMetadatas": [
                237,
                {
                    "paging": [
                        29,
                        "CursorPaging!"
                    ],
                    "filter": [
                        35,
                        "IndexFilter!"
                    ]
                }
            ],
            "__typename": [
                1
            ]
        },
        "CursorPaging": {
            "before": [
                31
            ],
            "after": [
                31
            ],
            "first": [
                30
            ],
            "last": [
                30
            ],
            "__typename": [
                1
            ]
        },
        "Int": {},
        "ConnectionCursor": {},
        "FieldFilter": {
            "and": [
                32
            ],
            "or": [
                32
            ],
            "id": [
                33
            ],
            "isActive": [
                34
            ],
            "isSystem": [
                34
            ],
            "isUIEditable": [
                34
            ],
            "isUIReadOnly": [
                34
            ],
            "objectMetadataId": [
                33
            ],
            "__typename": [
                1
            ]
        },
        "UUIDFilterComparison": {
            "is": [
                3
            ],
            "isNot": [
                3
            ],
            "eq": [
                4
            ],
            "neq": [
                4
            ],
            "gt": [
                4
            ],
            "gte": [
                4
            ],
            "lt": [
                4
            ],
            "lte": [
                4
            ],
            "like": [
                4
            ],
            "notLike": [
                4
            ],
            "iLike": [
                4
            ],
            "notILike": [
                4
            ],
            "in": [
                4
            ],
            "notIn": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "BooleanFieldComparison": {
            "is": [
                3
            ],
            "isNot": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "IndexFilter": {
            "and": [
                35
            ],
            "or": [
                35
            ],
            "id": [
                33
            ],
            "isCustom": [
                34
            ],
            "__typename": [
                1
            ]
        },
        "FullName": {
            "firstName": [
                1
            ],
            "lastName": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "WorkspaceMember": {
            "id": [
                4
            ],
            "name": [
                36
            ],
            "userEmail": [
                1
            ],
            "colorScheme": [
                1
            ],
            "avatarUrl": [
                1
            ],
            "locale": [
                1
            ],
            "calendarStartDay": [
                30
            ],
            "timeZone": [
                1
            ],
            "dateFormat": [
                38
            ],
            "timeFormat": [
                39
            ],
            "roles": [
                49
            ],
            "userWorkspaceId": [
                4
            ],
            "numberFormat": [
                40
            ],
            "__typename": [
                1
            ]
        },
        "WorkspaceMemberDateFormatEnum": {},
        "WorkspaceMemberTimeFormatEnum": {},
        "WorkspaceMemberNumberFormatEnum": {},
        "FieldPermission": {
            "id": [
                4
            ],
            "objectMetadataId": [
                4
            ],
            "fieldMetadataId": [
                4
            ],
            "roleId": [
                4
            ],
            "canReadFieldValue": [
                3
            ],
            "canUpdateFieldValue": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "RowLevelPermissionPredicateGroup": {
            "id": [
                1
            ],
            "parentRowLevelPermissionPredicateGroupId": [
                1
            ],
            "logicalOperator": [
                43
            ],
            "positionInRowLevelPermissionPredicateGroup": [
                16
            ],
            "roleId": [
                1
            ],
            "objectMetadataId": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "RowLevelPermissionPredicateGroupLogicalOperator": {},
        "RowLevelPermissionPredicate": {
            "id": [
                1
            ],
            "fieldMetadataId": [
                1
            ],
            "objectMetadataId": [
                1
            ],
            "operand": [
                45
            ],
            "subFieldName": [
                1
            ],
            "workspaceMemberFieldMetadataId": [
                1
            ],
            "workspaceMemberSubFieldName": [
                1
            ],
            "rowLevelPermissionPredicateGroupId": [
                1
            ],
            "positionInRowLevelPermissionPredicateGroup": [
                16
            ],
            "roleId": [
                1
            ],
            "value": [
                5
            ],
            "__typename": [
                1
            ]
        },
        "RowLevelPermissionPredicateOperand": {},
        "ObjectPermission": {
            "objectMetadataId": [
                4
            ],
            "canReadObjectRecords": [
                3
            ],
            "canUpdateObjectRecords": [
                3
            ],
            "canSoftDeleteObjectRecords": [
                3
            ],
            "canDestroyObjectRecords": [
                3
            ],
            "restrictedFields": [
                5
            ],
            "rowLevelPermissionPredicates": [
                44
            ],
            "rowLevelPermissionPredicateGroups": [
                42
            ],
            "__typename": [
                1
            ]
        },
        "RolePermissionFlag": {
            "id": [
                4
            ],
            "roleId": [
                4
            ],
            "flag": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "ApiKeyForRole": {
            "id": [
                4
            ],
            "name": [
                1
            ],
            "expiresAt": [
                6
            ],
            "revokedAt": [
                6
            ],
            "__typename": [
                1
            ]
        },
        "Role": {
            "id": [
                4
            ],
            "universalIdentifier": [
                4
            ],
            "label": [
                1
            ],
            "description": [
                1
            ],
            "icon": [
                1
            ],
            "isEditable": [
                3
            ],
            "canBeAssignedToUsers": [
                3
            ],
            "canBeAssignedToAgents": [
                3
            ],
            "canBeAssignedToApiKeys": [
                3
            ],
            "workspaceMembers": [
                37
            ],
            "agents": [
                11
            ],
            "apiKeys": [
                48
            ],
            "canUpdateAllSettings": [
                3
            ],
            "canAccessAllTools": [
                3
            ],
            "canReadAllObjectRecords": [
                3
            ],
            "canUpdateAllObjectRecords": [
                3
            ],
            "canSoftDeleteAllObjectRecords": [
                3
            ],
            "canDestroyAllObjectRecords": [
                3
            ],
            "permissionFlags": [
                47
            ],
            "objectPermissions": [
                46
            ],
            "fieldPermissions": [
                41
            ],
            "rowLevelPermissionPredicates": [
                44
            ],
            "rowLevelPermissionPredicateGroups": [
                42
            ],
            "__typename": [
                1
            ]
        },
        "Application": {
            "id": [
                4
            ],
            "name": [
                1
            ],
            "description": [
                1
            ],
            "logo": [
                1
            ],
            "logoFileId": [
                4
            ],
            "version": [
                1
            ],
            "universalIdentifier": [
                1
            ],
            "packageJsonChecksum": [
                1
            ],
            "packageJsonFileId": [
                4
            ],
            "yarnLockChecksum": [
                1
            ],
            "yarnLockFileId": [
                4
            ],
            "availablePackages": [
                5
            ],
            "applicationRegistrationId": [
                4
            ],
            "canBeUninstalled": [
                3
            ],
            "autoUpgrade": [
                3
            ],
            "defaultRoleId": [
                1
            ],
            "settingsCustomTabFrontComponentId": [
                4
            ],
            "defaultLogicFunctionRole": [
                49
            ],
            "agents": [
                11
            ],
            "frontComponents": [
                14
            ],
            "commandMenuItems": [
                15
            ],
            "logicFunctions": [
                22
            ],
            "objects": [
                28
            ],
            "applicationVariables": [
                10
            ],
            "applicationRegistration": [
                8
            ],
            "logoUrl": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "TwoFactorAuthenticationMethodSummary": {
            "twoFactorAuthenticationMethodId": [
                4
            ],
            "status": [
                1
            ],
            "strategy": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "UserWorkspace": {
            "id": [
                4
            ],
            "user": [
                73
            ],
            "userId": [
                4
            ],
            "locale": [
                1
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "deletedAt": [
                6
            ],
            "permissionFlags": [
                53
            ],
            "objectPermissions": [
                46
            ],
            "objectsPermissions": [
                46
            ],
            "twoFactorAuthenticationMethodSummary": [
                51
            ],
            "__typename": [
                1
            ]
        },
        "PermissionFlagType": {},
        "ViewField": {
            "id": [
                4
            ],
            "fieldMetadataId": [
                4
            ],
            "isVisible": [
                3
            ],
            "size": [
                16
            ],
            "position": [
                16
            ],
            "aggregateOperation": [
                55
            ],
            "viewId": [
                4
            ],
            "viewFieldGroupId": [
                4
            ],
            "workspaceId": [
                4
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "isActive": [
                3
            ],
            "deletedAt": [
                6
            ],
            "isOverridden": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "AggregateOperations": {},
        "ViewFilterGroup": {
            "id": [
                4
            ],
            "parentViewFilterGroupId": [
                4
            ],
            "logicalOperator": [
                57
            ],
            "positionInViewFilterGroup": [
                16
            ],
            "viewId": [
                4
            ],
            "workspaceId": [
                4
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "deletedAt": [
                6
            ],
            "__typename": [
                1
            ]
        },
        "ViewFilterGroupLogicalOperator": {},
        "ViewFilter": {
            "id": [
                4
            ],
            "fieldMetadataId": [
                4
            ],
            "operand": [
                59
            ],
            "value": [
                5
            ],
            "viewFilterGroupId": [
                4
            ],
            "positionInViewFilterGroup": [
                16
            ],
            "subFieldName": [
                1
            ],
            "relationTargetFieldMetadataId": [
                4
            ],
            "viewId": [
                4
            ],
            "workspaceId": [
                4
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "deletedAt": [
                6
            ],
            "__typename": [
                1
            ]
        },
        "ViewFilterOperand": {},
        "ViewGroup": {
            "id": [
                4
            ],
            "isVisible": [
                3
            ],
            "fieldValue": [
                1
            ],
            "position": [
                16
            ],
            "viewId": [
                4
            ],
            "workspaceId": [
                4
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "deletedAt": [
                6
            ],
            "__typename": [
                1
            ]
        },
        "ViewSort": {
            "id": [
                4
            ],
            "fieldMetadataId": [
                4
            ],
            "direction": [
                62
            ],
            "subFieldName": [
                1
            ],
            "viewId": [
                4
            ],
            "workspaceId": [
                4
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "deletedAt": [
                6
            ],
            "__typename": [
                1
            ]
        },
        "ViewSortDirection": {},
        "ViewFieldGroup": {
            "id": [
                4
            ],
            "name": [
                1
            ],
            "position": [
                16
            ],
            "isVisible": [
                3
            ],
            "viewId": [
                4
            ],
            "workspaceId": [
                4
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "isActive": [
                3
            ],
            "deletedAt": [
                6
            ],
            "viewFields": [
                54
            ],
            "isOverridden": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "View": {
            "id": [
                4
            ],
            "name": [
                1
            ],
            "objectMetadataId": [
                4
            ],
            "type": [
                65
            ],
            "key": [
                66
            ],
            "icon": [
                1
            ],
            "position": [
                16
            ],
            "isCompact": [
                3
            ],
            "isCustom": [
                3
            ],
            "openRecordIn": [
                67
            ],
            "kanbanAggregateOperation": [
                55
            ],
            "kanbanAggregateOperationFieldMetadataId": [
                4
            ],
            "mainGroupByFieldMetadataId": [
                4
            ],
            "shouldHideEmptyGroups": [
                3
            ],
            "kanbanColumnWidth": [
                30
            ],
            "calendarFieldMetadataId": [
                4
            ],
            "calendarEndFieldMetadataId": [
                4
            ],
            "workspaceId": [
                4
            ],
            "anyFieldFilterValue": [
                1
            ],
            "calendarLayout": [
                68
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "deletedAt": [
                6
            ],
            "viewFields": [
                54
            ],
            "viewFilters": [
                58
            ],
            "viewFilterGroups": [
                56
            ],
            "viewSorts": [
                61
            ],
            "viewGroups": [
                60
            ],
            "viewFieldGroups": [
                63
            ],
            "visibility": [
                69
            ],
            "createdByUserWorkspaceId": [
                4
            ],
            "isActive": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "ViewType": {},
        "ViewKey": {},
        "ViewOpenRecordIn": {},
        "ViewCalendarLayout": {},
        "ViewVisibility": {},
        "Workspace": {
            "id": [
                4
            ],
            "displayName": [
                1
            ],
            "logo": [
                1
            ],
            "logoFileId": [
                4
            ],
            "inviteHash": [
                1
            ],
            "deletedAt": [
                6
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "allowImpersonation": [
                3
            ],
            "isPublicInviteLinkEnabled": [
                3
            ],
            "workspaceDiscoverability": [
                71
            ],
            "trashRetentionDays": [
                16
            ],
            "eventLogRetentionDays": [
                16
            ],
            "workspaceMembersCount": [
                16
            ],
            "activationStatus": [
                72
            ],
            "views": [
                64
            ],
            "viewFields": [
                54
            ],
            "viewFilters": [
                58
            ],
            "viewFilterGroups": [
                56
            ],
            "viewGroups": [
                60
            ],
            "viewSorts": [
                61
            ],
            "metadataVersion": [
                16
            ],
            "databaseSchema": [
                1
            ],
            "subdomain": [
                1
            ],
            "customDomain": [
                1
            ],
            "isGoogleAuthEnabled": [
                3
            ],
            "isGoogleAuthBypassEnabled": [
                3
            ],
            "isTwoFactorAuthenticationEnforced": [
                3
            ],
            "isPasswordAuthEnabled": [
                3
            ],
            "isPasswordAuthBypassEnabled": [
                3
            ],
            "isMicrosoftAuthEnabled": [
                3
            ],
            "isMicrosoftAuthBypassEnabled": [
                3
            ],
            "isCustomDomainEnabled": [
                3
            ],
            "isInternalMessagesImportEnabled": [
                3
            ],
            "editableProfileFields": [
                1
            ],
            "defaultRole": [
                49
            ],
            "fastModel": [
                1
            ],
            "smartModel": [
                1
            ],
            "aiAdditionalInstructions": [
                1
            ],
            "enabledAiModelIds": [
                1
            ],
            "useRecommendedModels": [
                3
            ],
            "routerModel": [
                1
            ],
            "workspaceCustomApplication": [
                50
            ],
            "featureFlags": [
                178
            ],
            "billingSubscriptions": [
                138
            ],
            "installedApplications": [
                50
            ],
            "currentBillingSubscription": [
                138
            ],
            "billingCustomer": [
                140
            ],
            "billingEntitlements": [
                241
            ],
            "hasValidSignedEnterpriseKey": [
                3
            ],
            "hasValidEnterpriseValidityToken": [
                3
            ],
            "workspaceUrls": [
                180
            ],
            "workspaceCustomApplicationId": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "WorkspaceDiscoverability": {},
        "WorkspaceActivationStatus": {},
        "User": {
            "id": [
                4
            ],
            "firstName": [
                1
            ],
            "lastName": [
                1
            ],
            "email": [
                1
            ],
            "isEmailVerified": [
                3
            ],
            "disabled": [
                3
            ],
            "canImpersonate": [
                3
            ],
            "canAccessFullAdminPanel": [
                3
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "deletedAt": [
                6
            ],
            "locale": [
                1
            ],
            "workspaceMember": [
                37
            ],
            "userWorkspaces": [
                52
            ],
            "onboardingStatus": [
                74
            ],
            "currentWorkspace": [
                70
            ],
            "currentUserWorkspace": [
                52
            ],
            "userVars": [
                75
            ],
            "workspaceMembers": [
                37
            ],
            "deletedWorkspaceMembers": [
                222
            ],
            "hasPassword": [
                3
            ],
            "supportUserHash": [
                1
            ],
            "workspaces": [
                52
            ],
            "availableWorkspaces": [
                221
            ],
            "__typename": [
                1
            ]
        },
        "OnboardingStatus": {},
        "JSONObject": {},
        "ApplicationRegistration": {
            "id": [
                4
            ],
            "universalIdentifier": [
                1
            ],
            "name": [
                1
            ],
            "oAuthClientId": [
                1
            ],
            "oAuthRedirectUris": [
                1
            ],
            "oAuthScopes": [
                1
            ],
            "ownerWorkspaceId": [
                4
            ],
            "sourceType": [
                9
            ],
            "sourcePackage": [
                1
            ],
            "latestAvailableVersion": [
                1
            ],
            "isListed": [
                3
            ],
            "isVetted": [
                3
            ],
            "isPreInstalled": [
                3
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "isConfigured": [
                3
            ],
            "logoUrl": [
                1
            ],
            "galleryImagesUrls": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "SdkClientChecksums": {
            "core": [
                1
            ],
            "metadata": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "RatioAggregateConfig": {
            "fieldMetadataId": [
                4
            ],
            "optionValue": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "RichTextBody": {
            "blocknote": [
                1
            ],
            "markdown": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "GridPosition": {
            "row": [
                16
            ],
            "column": [
                16
            ],
            "rowSpan": [
                16
            ],
            "columnSpan": [
                16
            ],
            "__typename": [
                1
            ]
        },
        "PageLayoutWidget": {
            "id": [
                4
            ],
            "applicationId": [
                4
            ],
            "pageLayoutTabId": [
                4
            ],
            "title": [
                1
            ],
            "type": [
                82
            ],
            "objectMetadataId": [
                4
            ],
            "gridPosition": [
                80
            ],
            "position": [
                83
            ],
            "configuration": [
                88
            ],
            "conditionalDisplay": [
                5
            ],
            "conditionalAvailabilityExpression": [
                1
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "isActive": [
                3
            ],
            "deletedAt": [
                6
            ],
            "isOverridden": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "WidgetType": {},
        "PageLayoutWidgetPosition": {
            "on_PageLayoutWidgetGridPosition": [
                84
            ],
            "on_PageLayoutWidgetVerticalListPosition": [
                86
            ],
            "on_PageLayoutWidgetCanvasPosition": [
                87
            ],
            "__typename": [
                1
            ]
        },
        "PageLayoutWidgetGridPosition": {
            "layoutMode": [
                85
            ],
            "row": [
                30
            ],
            "column": [
                30
            ],
            "rowSpan": [
                30
            ],
            "columnSpan": [
                30
            ],
            "__typename": [
                1
            ]
        },
        "PageLayoutTabLayoutMode": {},
        "PageLayoutWidgetVerticalListPosition": {
            "layoutMode": [
                85
            ],
            "index": [
                30
            ],
            "__typename": [
                1
            ]
        },
        "PageLayoutWidgetCanvasPosition": {
            "layoutMode": [
                85
            ],
            "__typename": [
                1
            ]
        },
        "WidgetConfiguration": {
            "on_AggregateChartConfiguration": [
                89
            ],
            "on_StandaloneRichTextConfiguration": [
                92
            ],
            "on_PieChartConfiguration": [
                93
            ],
            "on_LineChartConfiguration": [
                96
            ],
            "on_IframeConfiguration": [
                98
            ],
            "on_BarChartConfiguration": [
                99
            ],
            "on_CalendarConfiguration": [
                102
            ],
            "on_FrontComponentConfiguration": [
                103
            ],
            "on_EmailsConfiguration": [
                104
            ],
            "on_EmailThreadConfiguration": [
                105
            ],
            "on_FieldConfiguration": [
                106
            ],
            "on_FieldRichTextConfiguration": [
                108
            ],
            "on_FieldsConfiguration": [
                109
            ],
            "on_FilesConfiguration": [
                110
            ],
            "on_NotesConfiguration": [
                111
            ],
            "on_TasksConfiguration": [
                112
            ],
            "on_TimelineConfiguration": [
                113
            ],
            "on_ViewConfiguration": [
                114
            ],
            "on_RecordTableConfiguration": [
                115
            ],
            "on_WorkflowConfiguration": [
                116
            ],
            "on_WorkflowRunConfiguration": [
                117
            ],
            "on_WorkflowVersionConfiguration": [
                118
            ],
            "__typename": [
                1
            ]
        },
        "AggregateChartConfiguration": {
            "configurationType": [
                90
            ],
            "aggregateFieldMetadataId": [
                4
            ],
            "aggregateOperation": [
                55
            ],
            "label": [
                1
            ],
            "displayDataLabel": [
                3
            ],
            "numberFormat": [
                91
            ],
            "description": [
                1
            ],
            "filter": [
                5
            ],
            "timezone": [
                1
            ],
            "firstDayOfTheWeek": [
                30
            ],
            "prefix": [
                1
            ],
            "suffix": [
                1
            ],
            "ratioAggregateConfig": [
                78
            ],
            "__typename": [
                1
            ]
        },
        "WidgetConfigurationType": {},
        "ChartNumberFormat": {},
        "StandaloneRichTextConfiguration": {
            "configurationType": [
                90
            ],
            "body": [
                79
            ],
            "__typename": [
                1
            ]
        },
        "PieChartConfiguration": {
            "configurationType": [
                90
            ],
            "aggregateFieldMetadataId": [
                4
            ],
            "aggregateOperation": [
                55
            ],
            "groupByFieldMetadataId": [
                4
            ],
            "groupBySubFieldName": [
                1
            ],
            "dateGranularity": [
                94
            ],
            "orderBy": [
                95
            ],
            "manualSortOrder": [
                1
            ],
            "displayDataLabel": [
                3
            ],
            "showCenterMetric": [
                3
            ],
            "displayLegend": [
                3
            ],
            "hideEmptyCategory": [
                3
            ],
            "splitMultiValueFields": [
                3
            ],
            "description": [
                1
            ],
            "color": [
                1
            ],
            "filter": [
                5
            ],
            "timezone": [
                1
            ],
            "firstDayOfTheWeek": [
                30
            ],
            "__typename": [
                1
            ]
        },
        "ObjectRecordGroupByDateGranularity": {},
        "GraphOrderBy": {},
        "LineChartConfiguration": {
            "configurationType": [
                90
            ],
            "aggregateFieldMetadataId": [
                4
            ],
            "aggregateOperation": [
                55
            ],
            "primaryAxisGroupByFieldMetadataId": [
                4
            ],
            "primaryAxisGroupBySubFieldName": [
                1
            ],
            "primaryAxisDateGranularity": [
                94
            ],
            "primaryAxisOrderBy": [
                95
            ],
            "primaryAxisManualSortOrder": [
                1
            ],
            "secondaryAxisGroupByFieldMetadataId": [
                4
            ],
            "secondaryAxisGroupBySubFieldName": [
                1
            ],
            "secondaryAxisGroupByDateGranularity": [
                94
            ],
            "secondaryAxisOrderBy": [
                95
            ],
            "secondaryAxisManualSortOrder": [
                1
            ],
            "omitNullValues": [
                3
            ],
            "splitMultiValueFields": [
                3
            ],
            "axisNameDisplay": [
                97
            ],
            "displayDataLabel": [
                3
            ],
            "displayLegend": [
                3
            ],
            "rangeMin": [
                16
            ],
            "rangeMax": [
                16
            ],
            "description": [
                1
            ],
            "color": [
                1
            ],
            "filter": [
                5
            ],
            "isStacked": [
                3
            ],
            "isCumulative": [
                3
            ],
            "timezone": [
                1
            ],
            "firstDayOfTheWeek": [
                30
            ],
            "__typename": [
                1
            ]
        },
        "AxisNameDisplay": {},
        "IframeConfiguration": {
            "configurationType": [
                90
            ],
            "url": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "BarChartConfiguration": {
            "configurationType": [
                90
            ],
            "aggregateFieldMetadataId": [
                4
            ],
            "aggregateOperation": [
                55
            ],
            "primaryAxisGroupByFieldMetadataId": [
                4
            ],
            "primaryAxisGroupBySubFieldName": [
                1
            ],
            "primaryAxisDateGranularity": [
                94
            ],
            "primaryAxisOrderBy": [
                95
            ],
            "primaryAxisManualSortOrder": [
                1
            ],
            "secondaryAxisGroupByFieldMetadataId": [
                4
            ],
            "secondaryAxisGroupBySubFieldName": [
                1
            ],
            "secondaryAxisGroupByDateGranularity": [
                94
            ],
            "secondaryAxisOrderBy": [
                95
            ],
            "secondaryAxisManualSortOrder": [
                1
            ],
            "omitNullValues": [
                3
            ],
            "splitMultiValueFields": [
                3
            ],
            "axisNameDisplay": [
                97
            ],
            "displayDataLabel": [
                3
            ],
            "displayLegend": [
                3
            ],
            "rangeMin": [
                16
            ],
            "rangeMax": [
                16
            ],
            "description": [
                1
            ],
            "color": [
                1
            ],
            "filter": [
                5
            ],
            "groupMode": [
                100
            ],
            "layout": [
                101
            ],
            "isCumulative": [
                3
            ],
            "timezone": [
                1
            ],
            "firstDayOfTheWeek": [
                30
            ],
            "__typename": [
                1
            ]
        },
        "BarChartGroupMode": {},
        "BarChartLayout": {},
        "CalendarConfiguration": {
            "configurationType": [
                90
            ],
            "__typename": [
                1
            ]
        },
        "FrontComponentConfiguration": {
            "configurationType": [
                90
            ],
            "frontComponentId": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "EmailsConfiguration": {
            "configurationType": [
                90
            ],
            "__typename": [
                1
            ]
        },
        "EmailThreadConfiguration": {
            "configurationType": [
                90
            ],
            "__typename": [
                1
            ]
        },
        "FieldConfiguration": {
            "configurationType": [
                90
            ],
            "fieldMetadataId": [
                1
            ],
            "fieldDisplayMode": [
                107
            ],
            "viewId": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "FieldDisplayMode": {},
        "FieldRichTextConfiguration": {
            "configurationType": [
                90
            ],
            "__typename": [
                1
            ]
        },
        "FieldsConfiguration": {
            "configurationType": [
                90
            ],
            "viewId": [
                1
            ],
            "newFieldDefaultVisibility": [
                3
            ],
            "shouldAllowUserToSeeHiddenFields": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "FilesConfiguration": {
            "configurationType": [
                90
            ],
            "__typename": [
                1
            ]
        },
        "NotesConfiguration": {
            "configurationType": [
                90
            ],
            "__typename": [
                1
            ]
        },
        "TasksConfiguration": {
            "configurationType": [
                90
            ],
            "__typename": [
                1
            ]
        },
        "TimelineConfiguration": {
            "configurationType": [
                90
            ],
            "__typename": [
                1
            ]
        },
        "ViewConfiguration": {
            "configurationType": [
                90
            ],
            "__typename": [
                1
            ]
        },
        "RecordTableConfiguration": {
            "configurationType": [
                90
            ],
            "viewId": [
                1
            ],
            "recordLimit": [
                30
            ],
            "__typename": [
                1
            ]
        },
        "WorkflowConfiguration": {
            "configurationType": [
                90
            ],
            "__typename": [
                1
            ]
        },
        "WorkflowRunConfiguration": {
            "configurationType": [
                90
            ],
            "__typename": [
                1
            ]
        },
        "WorkflowVersionConfiguration": {
            "configurationType": [
                90
            ],
            "__typename": [
                1
            ]
        },
        "PageLayoutTab": {
            "id": [
                4
            ],
            "applicationId": [
                4
            ],
            "title": [
                1
            ],
            "position": [
                16
            ],
            "pageLayoutId": [
                4
            ],
            "widgets": [
                81
            ],
            "icon": [
                1
            ],
            "layoutMode": [
                85
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "isActive": [
                3
            ],
            "deletedAt": [
                6
            ],
            "isOverridden": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "PageLayout": {
            "id": [
                4
            ],
            "name": [
                1
            ],
            "type": [
                121
            ],
            "objectMetadataId": [
                4
            ],
            "tabs": [
                119
            ],
            "defaultTabToFocusOnMobileAndSidePanelId": [
                4
            ],
            "universalIdentifier": [
                4
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "deletedAt": [
                6
            ],
            "__typename": [
                1
            ]
        },
        "PageLayoutType": {},
        "ApplicationConnectionProviderOAuthConfig": {
            "scopes": [
                1
            ],
            "isClientCredentialsConfigured": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "ApplicationConnectionProvider": {
            "id": [
                4
            ],
            "applicationId": [
                1
            ],
            "type": [
                1
            ],
            "name": [
                1
            ],
            "displayName": [
                1
            ],
            "oauth": [
                122
            ],
            "__typename": [
                1
            ]
        },
        "BillingSubscriptionSchedulePhaseItem": {
            "price": [
                1
            ],
            "quantity": [
                16
            ],
            "__typename": [
                1
            ]
        },
        "BillingSubscriptionSchedulePhase": {
            "start_date": [
                16
            ],
            "end_date": [
                16
            ],
            "items": [
                124
            ],
            "__typename": [
                1
            ]
        },
        "BillingProductMetadata": {
            "planKey": [
                127
            ],
            "priceUsageBased": [
                128
            ],
            "productKey": [
                129
            ],
            "__typename": [
                1
            ]
        },
        "BillingPlanKey": {},
        "BillingUsageType": {},
        "BillingProductKey": {},
        "BillingPriceLicensed": {
            "recurringInterval": [
                131
            ],
            "unitAmount": [
                16
            ],
            "stripePriceId": [
                1
            ],
            "priceUsageType": [
                128
            ],
            "creditAmount": [
                16
            ],
            "__typename": [
                1
            ]
        },
        "SubscriptionInterval": {},
        "BillingPriceTier": {
            "upTo": [
                16
            ],
            "flatAmount": [
                16
            ],
            "unitAmount": [
                16
            ],
            "__typename": [
                1
            ]
        },
        "BillingPriceMetered": {
            "tiers": [
                132
            ],
            "recurringInterval": [
                131
            ],
            "stripePriceId": [
                1
            ],
            "priceUsageType": [
                128
            ],
            "__typename": [
                1
            ]
        },
        "BillingProduct": {
            "name": [
                1
            ],
            "description": [
                1
            ],
            "images": [
                1
            ],
            "metadata": [
                126
            ],
            "__typename": [
                1
            ]
        },
        "BillingLicensedProduct": {
            "name": [
                1
            ],
            "description": [
                1
            ],
            "images": [
                1
            ],
            "metadata": [
                126
            ],
            "prices": [
                130
            ],
            "__typename": [
                1
            ]
        },
        "BillingMeteredProduct": {
            "name": [
                1
            ],
            "description": [
                1
            ],
            "images": [
                1
            ],
            "metadata": [
                126
            ],
            "prices": [
                133
            ],
            "__typename": [
                1
            ]
        },
        "BillingSubscriptionItem": {
            "id": [
                4
            ],
            "hasReachedCurrentPeriodCap": [
                3
            ],
            "quantity": [
                16
            ],
            "stripePriceId": [
                1
            ],
            "billingProduct": [
                0
            ],
            "__typename": [
                1
            ]
        },
        "BillingSubscription": {
            "id": [
                4
            ],
            "status": [
                139
            ],
            "interval": [
                131
            ],
            "billingSubscriptionItems": [
                137
            ],
            "currentPeriodEnd": [
                6
            ],
            "metadata": [
                5
            ],
            "phases": [
                125
            ],
            "cancelAt": [
                6
            ],
            "__typename": [
                1
            ]
        },
        "SubscriptionStatus": {},
        "BillingCustomer": {
            "id": [
                4
            ],
            "hasPaymentMethod": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "LogicFunctionExecutionResult": {
            "data": [
                5
            ],
            "logs": [
                1
            ],
            "duration": [
                16
            ],
            "status": [
                142
            ],
            "error": [
                5
            ],
            "__typename": [
                1
            ]
        },
        "LogicFunctionExecutionStatus": {},
        "EnterpriseLicenseInfoDTO": {
            "isValid": [
                3
            ],
            "licensee": [
                1
            ],
            "expiresAt": [
                6
            ],
            "subscriptionId": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "EnterpriseSubscriptionStatusDTO": {
            "status": [
                1
            ],
            "licensee": [
                1
            ],
            "expiresAt": [
                6
            ],
            "cancelAt": [
                6
            ],
            "currentPeriodEnd": [
                6
            ],
            "isCancellationScheduled": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "ApprovedAccessDomain": {
            "id": [
                4
            ],
            "domain": [
                1
            ],
            "isValidated": [
                3
            ],
            "createdAt": [
                6
            ],
            "__typename": [
                1
            ]
        },
        "FileWithSignedUrl": {
            "id": [
                4
            ],
            "path": [
                1
            ],
            "size": [
                16
            ],
            "createdAt": [
                6
            ],
            "url": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "FileUploadTarget": {
            "fileId": [
                4
            ],
            "uploadUrl": [
                1
            ],
            "contentType": [
                1
            ],
            "expiresAt": [
                6
            ],
            "__typename": [
                1
            ]
        },
        "BillingEndTrialPeriod": {
            "status": [
                139
            ],
            "hasPaymentMethod": [
                3
            ],
            "billingPortalUrl": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "BillingResourceCreditUsage": {
            "productKey": [
                129
            ],
            "periodStart": [
                6
            ],
            "periodEnd": [
                6
            ],
            "usedCredits": [
                16
            ],
            "grantedCredits": [
                16
            ],
            "rolloverCredits": [
                16
            ],
            "totalGrantedCredits": [
                16
            ],
            "unitPriceCents": [
                16
            ],
            "__typename": [
                1
            ]
        },
        "BillingPlan": {
            "planKey": [
                127
            ],
            "baseProducts": [
                135
            ],
            "resourceCreditProducts": [
                135
            ],
            "meteredProducts": [
                136
            ],
            "__typename": [
                1
            ]
        },
        "BillingPaymentIntent": {
            "clientSecret": [
                1
            ],
            "paymentIntentType": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "BillingSession": {
            "url": [
                1
            ],
            "razorpaySubscriptionId": [
                1
            ],
            "razorpayKeyId": [
                1
            ],
            "razorpayCallbackUrl": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "BillingUpdate": {
            "currentBillingSubscription": [
                138
            ],
            "billingSubscriptions": [
                138
            ],
            "__typename": [
                1
            ]
        },
        "BillingProviderOutput": {
            "provider": [
                155
            ],
            "__typename": [
                1
            ]
        },
        "BillingProviderEnum": {},
        "CreditPackOutput": {
            "key": [
                1
            ],
            "name": [
                1
            ],
            "credits": [
                16
            ],
            "amountSubunits": [
                16
            ],
            "currency": [
                1
            ],
            "planId": [
                1
            ],
            "intent": [
                1
            ],
            "mapsCount": [
                16
            ],
            "mapType": [
                1
            ],
            "mapTypeLabel": [
                1
            ],
            "tagline": [
                1
            ],
            "inheritedFromPlanId": [
                1
            ],
            "ownFeatures": [
                1
            ],
            "includedEmailCredits": [
                16
            ],
            "includedPhoneCredits": [
                16
            ],
            "creditsDisplay": [
                1
            ],
            "pricesSubunitsJson": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "CreditTransactionOutput": {
            "id": [
                1
            ],
            "type": [
                1
            ],
            "creditType": [
                1
            ],
            "amount": [
                16
            ],
            "metadata": [
                5
            ],
            "createdAt": [
                6
            ],
            "__typename": [
                1
            ]
        },
        "CreditTransactionsOutput": {
            "items": [
                157
            ],
            "nextCursor": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "EngagementPlanOutput": {
            "id": [
                1
            ],
            "name": [
                1
            ],
            "amount": [
                16
            ],
            "currency": [
                1
            ],
            "period": [
                1
            ],
            "interval": [
                16
            ],
            "__typename": [
                1
            ]
        },
        "RazorpayOrderOutput": {
            "orderId": [
                1
            ],
            "amount": [
                16
            ],
            "currency": [
                1
            ],
            "keyId": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "RequestInvoiceForCreditsOutput": {
            "success": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "WorkspaceCreditsOutput": {
            "orgChartCredits": [
                16
            ],
            "revealCredits": [
                16
            ],
            "revealCreditsAsEmailEquivalent": [
                16
            ],
            "revealCreditsAsPhoneEquivalent": [
                16
            ],
            "emailRevealCost": [
                16
            ],
            "phoneRevealCost": [
                16
            ],
            "__typename": [
                1
            ]
        },
        "AiProviderCredential": {
            "id": [
                1
            ],
            "providerName": [
                1
            ],
            "isFilled": [
                3
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "__typename": [
                1
            ]
        },
        "InviteSuggestion": {
            "email": [
                1
            ],
            "displayName": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "OnboardingStepSuccess": {
            "success": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "WorkspaceInvitation": {
            "id": [
                4
            ],
            "email": [
                1
            ],
            "roleId": [
                4
            ],
            "expiresAt": [
                6
            ],
            "__typename": [
                1
            ]
        },
        "SendInvitations": {
            "success": [
                3
            ],
            "errors": [
                1
            ],
            "result": [
                166
            ],
            "__typename": [
                1
            ]
        },
        "RecordIdentifier": {
            "id": [
                4
            ],
            "labelIdentifier": [
                1
            ],
            "imageIdentifier": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "NavigationMenuItem": {
            "id": [
                4
            ],
            "userWorkspaceId": [
                4
            ],
            "targetRecordId": [
                4
            ],
            "targetObjectMetadataId": [
                4
            ],
            "viewId": [
                4
            ],
            "type": [
                170
            ],
            "name": [
                1
            ],
            "link": [
                1
            ],
            "icon": [
                1
            ],
            "color": [
                1
            ],
            "folderId": [
                4
            ],
            "pageLayoutId": [
                4
            ],
            "position": [
                16
            ],
            "applicationId": [
                4
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "targetRecordIdentifier": [
                168
            ],
            "__typename": [
                1
            ]
        },
        "NavigationMenuItemType": {},
        "ObjectRecordEventProperties": {
            "updatedFields": [
                1
            ],
            "before": [
                5
            ],
            "after": [
                5
            ],
            "diff": [
                5
            ],
            "__typename": [
                1
            ]
        },
        "MetadataEvent": {
            "type": [
                173
            ],
            "metadataName": [
                1
            ],
            "recordId": [
                1
            ],
            "properties": [
                171
            ],
            "updatedCollectionHash": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "MetadataEventAction": {},
        "ObjectRecordEvent": {
            "action": [
                175
            ],
            "objectNameSingular": [
                1
            ],
            "recordId": [
                1
            ],
            "userId": [
                1
            ],
            "workspaceMemberId": [
                1
            ],
            "properties": [
                171
            ],
            "__typename": [
                1
            ]
        },
        "DatabaseEventAction": {},
        "ObjectRecordEventWithQueryIds": {
            "queryIds": [
                1
            ],
            "objectRecordEvent": [
                174
            ],
            "__typename": [
                1
            ]
        },
        "EventSubscription": {
            "eventStreamId": [
                1
            ],
            "objectRecordEventsWithQueryIds": [
                176
            ],
            "metadataEvents": [
                172
            ],
            "__typename": [
                1
            ]
        },
        "FeatureFlag": {
            "key": [
                179
            ],
            "value": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "FeatureFlagKey": {},
        "WorkspaceUrls": {
            "customUrl": [
                1
            ],
            "subdomainUrl": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "ApplicationRegistrationVariableDTO": {
            "id": [
                4
            ],
            "key": [
                1
            ],
            "value": [
                1
            ],
            "description": [
                1
            ],
            "isSecret": [
                3
            ],
            "isRequired": [
                3
            ],
            "isFilled": [
                3
            ],
            "type": [
                1
            ],
            "options": [
                5
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "__typename": [
                1
            ]
        },
        "VersionDistributionEntry": {
            "version": [
                1
            ],
            "count": [
                30
            ],
            "__typename": [
                1
            ]
        },
        "ApplicationRegistrationStats": {
            "activeInstalls": [
                30
            ],
            "mostInstalledVersion": [
                1
            ],
            "versionDistribution": [
                182
            ],
            "__typename": [
                1
            ]
        },
        "BillingTrialPeriod": {
            "duration": [
                16
            ],
            "isCreditCardRequired": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "SSOIdentityProvider": {
            "id": [
                4
            ],
            "name": [
                1
            ],
            "type": [
                186
            ],
            "status": [
                187
            ],
            "issuer": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "IdentityProviderType": {},
        "SSOIdentityProviderStatus": {},
        "AuthProviders": {
            "sso": [
                185
            ],
            "google": [
                3
            ],
            "magicLink": [
                3
            ],
            "password": [
                3
            ],
            "microsoft": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "AuthBypassProviders": {
            "google": [
                3
            ],
            "password": [
                3
            ],
            "microsoft": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "PublicWorkspaceData": {
            "id": [
                4
            ],
            "authProviders": [
                188
            ],
            "authBypassProviders": [
                189
            ],
            "logo": [
                1
            ],
            "displayName": [
                1
            ],
            "workspaceUrls": [
                180
            ],
            "__typename": [
                1
            ]
        },
        "PublicWorkspaceDataSummary": {
            "id": [
                4
            ],
            "logo": [
                1
            ],
            "displayName": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "NativeModelCapabilities": {
            "webSearch": [
                3
            ],
            "twitterSearch": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "ClientAiModelConfig": {
            "modelId": [
                1
            ],
            "label": [
                1
            ],
            "modelFamily": [
                194
            ],
            "modelFamilyLabel": [
                1
            ],
            "sdkPackage": [
                1
            ],
            "inputCostPerMillionTokens": [
                16
            ],
            "outputCostPerMillionTokens": [
                16
            ],
            "nativeCapabilities": [
                192
            ],
            "isDeprecated": [
                3
            ],
            "isRecommended": [
                3
            ],
            "providerName": [
                1
            ],
            "providerLabel": [
                1
            ],
            "contextWindowTokens": [
                16
            ],
            "maxOutputTokens": [
                16
            ],
            "dataResidency": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "ModelFamily": {},
        "Billing": {
            "isBillingEnabled": [
                3
            ],
            "billingUrl": [
                1
            ],
            "stripePublishableKey": [
                1
            ],
            "provider": [
                1
            ],
            "trialPeriods": [
                184
            ],
            "__typename": [
                1
            ]
        },
        "Support": {
            "supportDriver": [
                197
            ],
            "supportFrontChatId": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "SupportDriver": {},
        "Sentry": {
            "environment": [
                1
            ],
            "release": [
                1
            ],
            "dsn": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "Captcha": {
            "provider": [
                200
            ],
            "siteKey": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "CaptchaDriverType": {},
        "ApiConfig": {
            "mutationMaximumAffectedRecords": [
                16
            ],
            "__typename": [
                1
            ]
        },
        "PublicFeatureFlagMetadata": {
            "label": [
                1
            ],
            "description": [
                1
            ],
            "imagePath": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "PublicFeatureFlag": {
            "key": [
                179
            ],
            "metadata": [
                202
            ],
            "__typename": [
                1
            ]
        },
        "ClientConfigMaintenanceMode": {
            "startAt": [
                6
            ],
            "endAt": [
                6
            ],
            "link": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "ClientConfig": {
            "appVersion": [
                1
            ],
            "authProviders": [
                188
            ],
            "billing": [
                195
            ],
            "aiModels": [
                193
            ],
            "signInPrefilled": [
                3
            ],
            "isMultiWorkspaceEnabled": [
                3
            ],
            "isEmailVerificationRequired": [
                3
            ],
            "defaultSubdomain": [
                1
            ],
            "frontDomain": [
                1
            ],
            "publicFunctionDomain": [
                1
            ],
            "analyticsEnabled": [
                3
            ],
            "support": [
                196
            ],
            "isAttachmentPreviewEnabled": [
                3
            ],
            "sentry": [
                198
            ],
            "captcha": [
                199
            ],
            "chromeExtensionId": [
                1
            ],
            "api": [
                201
            ],
            "canManageFeatureFlags": [
                3
            ],
            "publicFeatureFlags": [
                203
            ],
            "isMicrosoftMessagingEnabled": [
                3
            ],
            "isMicrosoftCalendarEnabled": [
                3
            ],
            "isGoogleMessagingEnabled": [
                3
            ],
            "isGoogleCalendarEnabled": [
                3
            ],
            "isConfigVariablesInDbEnabled": [
                3
            ],
            "isImapSmtpCaldavEnabled": [
                3
            ],
            "isEmailingDomainInDemoMode": [
                3
            ],
            "allowRequestsToTwentyIcons": [
                3
            ],
            "calendarBookingPageId": [
                1
            ],
            "isCloudflareIntegrationEnabled": [
                3
            ],
            "isClickHouseConfigured": [
                3
            ],
            "isWorkspaceSchemaDDLLocked": [
                3
            ],
            "enterpriseInstanceType": [
                1
            ],
            "maintenance": [
                204
            ],
            "__typename": [
                1
            ]
        },
        "UsageBreakdownItem": {
            "key": [
                1
            ],
            "label": [
                1
            ],
            "creditsUsed": [
                16
            ],
            "__typename": [
                1
            ]
        },
        "ClaimableApplicationRegistration": {
            "id": [
                1
            ],
            "universalIdentifier": [
                1
            ],
            "name": [
                1
            ],
            "sourcePackage": [
                1
            ],
            "logoUrl": [
                1
            ],
            "description": [
                1
            ],
            "author": [
                1
            ],
            "isOwned": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "CreateApplicationRegistration": {
            "applicationRegistration": [
                76
            ],
            "clientSecret": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "PublicApplicationRegistration": {
            "id": [
                4
            ],
            "name": [
                1
            ],
            "logoUrl": [
                1
            ],
            "websiteUrl": [
                1
            ],
            "oAuthScopes": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "RotateClientSecret": {
            "clientSecret": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "AppConnection": {
            "id": [
                212
            ],
            "providerName": [
                1
            ],
            "name": [
                1
            ],
            "handle": [
                1
            ],
            "visibility": [
                1
            ],
            "userWorkspaceId": [
                1
            ],
            "accessToken": [
                1
            ],
            "scopes": [
                1
            ],
            "authFailedAt": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "ID": {},
        "ResendEmailVerificationToken": {
            "success": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "DeleteSso": {
            "identityProviderId": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "EditSso": {
            "id": [
                4
            ],
            "type": [
                186
            ],
            "issuer": [
                1
            ],
            "name": [
                1
            ],
            "status": [
                187
            ],
            "__typename": [
                1
            ]
        },
        "WorkspaceNameAndId": {
            "displayName": [
                1
            ],
            "id": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "FindAvailableSSOIDP": {
            "type": [
                186
            ],
            "id": [
                4
            ],
            "issuer": [
                1
            ],
            "name": [
                1
            ],
            "status": [
                187
            ],
            "workspace": [
                216
            ],
            "__typename": [
                1
            ]
        },
        "SetupSso": {
            "id": [
                4
            ],
            "type": [
                186
            ],
            "issuer": [
                1
            ],
            "name": [
                1
            ],
            "status": [
                187
            ],
            "__typename": [
                1
            ]
        },
        "SSOConnection": {
            "type": [
                186
            ],
            "id": [
                4
            ],
            "issuer": [
                1
            ],
            "name": [
                1
            ],
            "status": [
                187
            ],
            "__typename": [
                1
            ]
        },
        "AvailableWorkspace": {
            "id": [
                4
            ],
            "displayName": [
                1
            ],
            "loginToken": [
                1
            ],
            "personalInviteToken": [
                1
            ],
            "inviteHash": [
                1
            ],
            "workspaceUrls": [
                180
            ],
            "logo": [
                1
            ],
            "sso": [
                219
            ],
            "__typename": [
                1
            ]
        },
        "AvailableWorkspaces": {
            "availableWorkspacesForSignIn": [
                220
            ],
            "availableWorkspacesForSignUp": [
                220
            ],
            "__typename": [
                1
            ]
        },
        "DeletedWorkspaceMember": {
            "id": [
                4
            ],
            "name": [
                36
            ],
            "userEmail": [
                1
            ],
            "avatarUrl": [
                1
            ],
            "userWorkspaceId": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "MarketplaceApp": {
            "id": [
                1
            ],
            "name": [
                1
            ],
            "description": [
                1
            ],
            "author": [
                1
            ],
            "category": [
                1
            ],
            "logo": [
                1
            ],
            "sourcePackage": [
                1
            ],
            "isVetted": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "MarketplaceAppRoleObjectPermission": {
            "universalIdentifier": [
                1
            ],
            "objectUniversalIdentifier": [
                1
            ],
            "canReadObjectRecords": [
                3
            ],
            "canUpdateObjectRecords": [
                3
            ],
            "canSoftDeleteObjectRecords": [
                3
            ],
            "canDestroyObjectRecords": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "MarketplaceAppRoleFieldPermission": {
            "universalIdentifier": [
                1
            ],
            "objectUniversalIdentifier": [
                1
            ],
            "fieldUniversalIdentifier": [
                1
            ],
            "canReadFieldValue": [
                3
            ],
            "canUpdateFieldValue": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "MarketplaceAppRole": {
            "universalIdentifier": [
                1
            ],
            "label": [
                1
            ],
            "description": [
                1
            ],
            "icon": [
                1
            ],
            "canUpdateAllSettings": [
                3
            ],
            "canAccessAllTools": [
                3
            ],
            "canReadAllObjectRecords": [
                3
            ],
            "canUpdateAllObjectRecords": [
                3
            ],
            "canSoftDeleteAllObjectRecords": [
                3
            ],
            "canDestroyAllObjectRecords": [
                3
            ],
            "permissionFlagUniversalIdentifiers": [
                1
            ],
            "objectPermissions": [
                224
            ],
            "fieldPermissions": [
                225
            ],
            "__typename": [
                1
            ]
        },
        "MarketplaceAppDetail": {
            "universalIdentifier": [
                1
            ],
            "id": [
                1
            ],
            "name": [
                1
            ],
            "sourceType": [
                9
            ],
            "sourcePackage": [
                1
            ],
            "latestAvailableVersion": [
                1
            ],
            "isListed": [
                3
            ],
            "isVetted": [
                3
            ],
            "description": [
                1
            ],
            "author": [
                1
            ],
            "category": [
                1
            ],
            "logo": [
                1
            ],
            "websiteUrl": [
                1
            ],
            "aboutDescription": [
                1
            ],
            "termsUrl": [
                1
            ],
            "emailSupport": [
                1
            ],
            "issueReportUrl": [
                1
            ],
            "screenshots": [
                1
            ],
            "galleryImages": [
                1
            ],
            "defaultRoleUniversalIdentifier": [
                1
            ],
            "roles": [
                226
            ],
            "manifest": [
                5
            ],
            "__typename": [
                1
            ]
        },
        "Relation": {
            "type": [
                229
            ],
            "sourceObjectMetadata": [
                28
            ],
            "targetObjectMetadata": [
                28
            ],
            "sourceFieldMetadata": [
                24
            ],
            "targetFieldMetadata": [
                24
            ],
            "__typename": [
                1
            ]
        },
        "RelationType": {},
        "IndexField": {
            "id": [
                4
            ],
            "fieldMetadataId": [
                4
            ],
            "order": [
                16
            ],
            "subFieldName": [
                1
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "__typename": [
                1
            ]
        },
        "ObjectRecordCount": {
            "objectNamePlural": [
                1
            ],
            "totalCount": [
                30
            ],
            "__typename": [
                1
            ]
        },
        "SearchField": {
            "id": [
                4
            ],
            "fieldMetadataId": [
                4
            ],
            "tsVectorFieldMetadataId": [
                4
            ],
            "position": [
                16
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "__typename": [
                1
            ]
        },
        "ObjectEdge": {
            "node": [
                28
            ],
            "cursor": [
                31
            ],
            "__typename": [
                1
            ]
        },
        "PageInfo": {
            "hasNextPage": [
                3
            ],
            "hasPreviousPage": [
                3
            ],
            "startCursor": [
                31
            ],
            "endCursor": [
                31
            ],
            "__typename": [
                1
            ]
        },
        "ObjectConnection": {
            "pageInfo": [
                234
            ],
            "edges": [
                233
            ],
            "__typename": [
                1
            ]
        },
        "IndexEdge": {
            "node": [
                26
            ],
            "cursor": [
                31
            ],
            "__typename": [
                1
            ]
        },
        "ObjectIndexMetadatasConnection": {
            "pageInfo": [
                234
            ],
            "edges": [
                236
            ],
            "__typename": [
                1
            ]
        },
        "FieldEdge": {
            "node": [
                24
            ],
            "cursor": [
                31
            ],
            "__typename": [
                1
            ]
        },
        "ObjectFieldsConnection": {
            "pageInfo": [
                234
            ],
            "edges": [
                238
            ],
            "__typename": [
                1
            ]
        },
        "FieldConnection": {
            "pageInfo": [
                234
            ],
            "edges": [
                238
            ],
            "__typename": [
                1
            ]
        },
        "BillingEntitlement": {
            "key": [
                242
            ],
            "value": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "BillingEntitlementKey": {},
        "DomainRecord": {
            "validationType": [
                1
            ],
            "type": [
                1
            ],
            "status": [
                1
            ],
            "key": [
                1
            ],
            "value": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "DomainValidRecords": {
            "id": [
                4
            ],
            "domain": [
                1
            ],
            "records": [
                243
            ],
            "isCustomDomainEnabled": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "UpsertRowLevelPermissionPredicatesResult": {
            "predicates": [
                44
            ],
            "predicateGroups": [
                42
            ],
            "__typename": [
                1
            ]
        },
        "LogicFunctionLogs": {
            "logs": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "PublicConnectionParametersOutput": {
            "host": [
                1
            ],
            "port": [
                16
            ],
            "username": [
                1
            ],
            "connectionSecurity": [
                248
            ],
            "__typename": [
                1
            ]
        },
        "EmailConnectionSecurity": {},
        "PublicImapSmtpCaldavConnectionParameters": {
            "IMAP": [
                247
            ],
            "SMTP": [
                247
            ],
            "CALDAV": [
                247
            ],
            "__typename": [
                1
            ]
        },
        "ConnectedAccountPublicDTO": {
            "id": [
                4
            ],
            "handle": [
                1
            ],
            "provider": [
                1
            ],
            "lastCredentialsRefreshedAt": [
                6
            ],
            "authFailedAt": [
                6
            ],
            "archivedAt": [
                6
            ],
            "handleAliases": [
                1
            ],
            "scopes": [
                1
            ],
            "lastSignedInAt": [
                6
            ],
            "userWorkspaceId": [
                4
            ],
            "connectionProviderId": [
                4
            ],
            "applicationId": [
                4
            ],
            "name": [
                1
            ],
            "visibility": [
                1
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "connectionParameters": [
                249
            ],
            "__typename": [
                1
            ]
        },
        "DeleteTwoFactorAuthenticationMethod": {
            "success": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "InitiateTwoFactorAuthenticationProvisioning": {
            "uri": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "VerifyTwoFactorAuthenticationMethod": {
            "success": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "AuthorizeApp": {
            "redirectUrl": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "AuthTokenPair": {
            "accessOrWorkspaceAgnosticToken": [
                12
            ],
            "refreshToken": [
                12
            ],
            "__typename": [
                1
            ]
        },
        "AvailableWorkspacesAndAccessTokens": {
            "tokens": [
                255
            ],
            "availableWorkspaces": [
                221
            ],
            "__typename": [
                1
            ]
        },
        "EmailPasswordResetLink": {
            "success": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "GetAuthorizationUrlForSSO": {
            "authorizationURL": [
                1
            ],
            "type": [
                1
            ],
            "id": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "InvalidatePassword": {
            "success": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "WorkspaceUrlsAndId": {
            "workspaceUrls": [
                180
            ],
            "id": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "SignUp": {
            "loginToken": [
                12
            ],
            "workspace": [
                260
            ],
            "__typename": [
                1
            ]
        },
        "TransientToken": {
            "transientToken": [
                12
            ],
            "__typename": [
                1
            ]
        },
        "ValidatePasswordResetToken": {
            "id": [
                4
            ],
            "email": [
                1
            ],
            "hasPassword": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "VerifyEmailAndGetLoginToken": {
            "loginToken": [
                12
            ],
            "workspaceUrls": [
                180
            ],
            "__typename": [
                1
            ]
        },
        "SubdomainAvailabilityDTO": {
            "isValid": [
                3
            ],
            "available": [
                3
            ],
            "suggestedSubdomain": [
                1
            ],
            "suggestedSubdomains": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "WorkspaceCreationDefaultsDTO": {
            "displayName": [
                1
            ],
            "subdomain": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "ApiKeyToken": {
            "token": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "AuthTokens": {
            "tokens": [
                255
            ],
            "__typename": [
                1
            ]
        },
        "LoginToken": {
            "loginToken": [
                12
            ],
            "__typename": [
                1
            ]
        },
        "CheckUserExist": {
            "exists": [
                3
            ],
            "availableWorkspacesCount": [
                16
            ],
            "isEmailVerified": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "WorkspaceInviteHashValid": {
            "isValid": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "Impersonate": {
            "loginToken": [
                12
            ],
            "workspace": [
                260
            ],
            "__typename": [
                1
            ]
        },
        "UsageTimeSeries": {
            "date": [
                1
            ],
            "creditsUsed": [
                16
            ],
            "__typename": [
                1
            ]
        },
        "UsageUserDaily": {
            "userWorkspaceId": [
                1
            ],
            "dailyUsage": [
                273
            ],
            "__typename": [
                1
            ]
        },
        "UsageAnalytics": {
            "usageByUser": [
                206
            ],
            "usageByOperationType": [
                206
            ],
            "usageByModel": [
                206
            ],
            "timeSeries": [
                273
            ],
            "periodStart": [
                6
            ],
            "periodEnd": [
                6
            ],
            "userDailyUsage": [
                274
            ],
            "__typename": [
                1
            ]
        },
        "DevelopmentApplication": {
            "id": [
                1
            ],
            "universalIdentifier": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "WorkspaceMigration": {
            "applicationUniversalIdentifier": [
                1
            ],
            "actions": [
                5
            ],
            "__typename": [
                1
            ]
        },
        "File": {
            "id": [
                4
            ],
            "path": [
                1
            ],
            "size": [
                16
            ],
            "createdAt": [
                6
            ],
            "__typename": [
                1
            ]
        },
        "PublicDomain": {
            "id": [
                4
            ],
            "domain": [
                1
            ],
            "isValidated": [
                3
            ],
            "applicationId": [
                4
            ],
            "createdAt": [
                6
            ],
            "__typename": [
                1
            ]
        },
        "VerificationRecord": {
            "type": [
                1
            ],
            "key": [
                1
            ],
            "value": [
                1
            ],
            "priority": [
                16
            ],
            "status": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "EmailingDomain": {
            "id": [
                4
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "domain": [
                1
            ],
            "status": [
                282
            ],
            "verificationRecords": [
                280
            ],
            "verifiedAt": [
                6
            ],
            "__typename": [
                1
            ]
        },
        "EmailingDomainStatus": {},
        "AutocompleteResult": {
            "text": [
                1
            ],
            "placeId": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "Location": {
            "lat": [
                16
            ],
            "lng": [
                16
            ],
            "__typename": [
                1
            ]
        },
        "PlaceDetailsResult": {
            "street": [
                1
            ],
            "state": [
                1
            ],
            "postcode": [
                1
            ],
            "city": [
                1
            ],
            "country": [
                1
            ],
            "location": [
                284
            ],
            "__typename": [
                1
            ]
        },
        "ImapSmtpCaldavPublicConnectionParams": {
            "host": [
                1
            ],
            "port": [
                16
            ],
            "username": [
                1
            ],
            "connectionSecurity": [
                248
            ],
            "__typename": [
                1
            ]
        },
        "ImapSmtpCaldavPublicConnectionParameters": {
            "name": [
                1
            ],
            "IMAP": [
                286
            ],
            "SMTP": [
                286
            ],
            "CALDAV": [
                286
            ],
            "__typename": [
                1
            ]
        },
        "ConnectedImapSmtpCaldavAccount": {
            "id": [
                4
            ],
            "handle": [
                1
            ],
            "provider": [
                1
            ],
            "userWorkspaceId": [
                4
            ],
            "connectionParameters": [
                287
            ],
            "__typename": [
                1
            ]
        },
        "ImapSmtpCaldavConnectionSuccess": {
            "success": [
                3
            ],
            "connectedAccountId": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "MessageChannel": {
            "id": [
                4
            ],
            "visibility": [
                291
            ],
            "handle": [
                1
            ],
            "type": [
                292
            ],
            "isContactAutoCreationEnabled": [
                3
            ],
            "contactAutoCreationPolicy": [
                293
            ],
            "messageFolderImportPolicy": [
                294
            ],
            "excludeNonProfessionalEmails": [
                3
            ],
            "excludeGroupEmails": [
                3
            ],
            "pendingGroupEmailsAction": [
                295
            ],
            "isSyncEnabled": [
                3
            ],
            "syncedAt": [
                6
            ],
            "syncStatus": [
                296
            ],
            "syncStage": [
                297
            ],
            "syncStageStartedAt": [
                6
            ],
            "throttleFailureCount": [
                16
            ],
            "throttleRetryAfter": [
                6
            ],
            "connectedAccountId": [
                4
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "connectedAccount": [
                250
            ],
            "__typename": [
                1
            ]
        },
        "MessageChannelVisibility": {},
        "MessageChannelType": {},
        "MessageChannelContactAutoCreationPolicy": {},
        "MessageFolderImportPolicy": {},
        "MessageChannelPendingGroupEmailsAction": {},
        "MessageChannelSyncStatus": {},
        "MessageChannelSyncStage": {},
        "CreateEmailGroupChannelOutput": {
            "messageChannel": [
                290
            ],
            "forwardingAddress": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "CampaignAudiencePreviewDTO": {
            "totalMembers": [
                30
            ],
            "withoutEmail": [
                30
            ],
            "duplicateEmails": [
                30
            ],
            "globallyUnsubscribed": [
                30
            ],
            "topicUnsubscribed": [
                30
            ],
            "sendable": [
                30
            ],
            "__typename": [
                1
            ]
        },
        "SendEmailViaDomainOutput": {
            "messageId": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "CampaignSkippedRecipientsDTO": {
            "noEmail": [
                30
            ],
            "deduped": [
                30
            ],
            "overCap": [
                30
            ],
            "__typename": [
                1
            ]
        },
        "SendMessageCampaignOutputDTO": {
            "campaignId": [
                1
            ],
            "queuedCount": [
                30
            ],
            "skipped": [
                301
            ],
            "__typename": [
                1
            ]
        },
        "UnsubscribeTopic": {
            "id": [
                4
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "name": [
                1
            ],
            "description": [
                1
            ],
            "visibility": [
                304
            ],
            "__typename": [
                1
            ]
        },
        "UnsubscribeTopicVisibility": {},
        "Webhook": {
            "id": [
                4
            ],
            "targetUrl": [
                1
            ],
            "operations": [
                1
            ],
            "description": [
                1
            ],
            "secret": [
                1
            ],
            "applicationId": [
                4
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "deletedAt": [
                6
            ],
            "__typename": [
                1
            ]
        },
        "ToolIndexEntry": {
            "name": [
                1
            ],
            "label": [
                1
            ],
            "description": [
                1
            ],
            "category": [
                1
            ],
            "objectName": [
                1
            ],
            "icon": [
                1
            ],
            "inputSchema": [
                5
            ],
            "__typename": [
                1
            ]
        },
        "AgentMessagePart": {
            "id": [
                4
            ],
            "messageId": [
                4
            ],
            "orderIndex": [
                30
            ],
            "type": [
                1
            ],
            "textContent": [
                1
            ],
            "reasoningContent": [
                1
            ],
            "toolName": [
                1
            ],
            "toolCallId": [
                1
            ],
            "toolInput": [
                5
            ],
            "toolOutput": [
                5
            ],
            "state": [
                1
            ],
            "providerExecuted": [
                3
            ],
            "errorMessage": [
                1
            ],
            "errorDetails": [
                5
            ],
            "sourceUrlSourceId": [
                1
            ],
            "sourceUrlUrl": [
                1
            ],
            "sourceUrlTitle": [
                1
            ],
            "sourceDocumentSourceId": [
                1
            ],
            "sourceDocumentMediaType": [
                1
            ],
            "sourceDocumentTitle": [
                1
            ],
            "sourceDocumentFilename": [
                1
            ],
            "fileMediaType": [
                1
            ],
            "fileFilename": [
                1
            ],
            "fileId": [
                4
            ],
            "fileUrl": [
                1
            ],
            "providerMetadata": [
                5
            ],
            "createdAt": [
                6
            ],
            "__typename": [
                1
            ]
        },
        "RunAgentResult": {
            "result": [
                5
            ],
            "error": [
                1
            ],
            "success": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "CreateCalendarEventOutput": {
            "success": [
                3
            ],
            "iCalUid": [
                1
            ],
            "conferenceLink": [
                1
            ],
            "error": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "ChannelSyncSuccess": {
            "success": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "BarChartSeries": {
            "key": [
                1
            ],
            "label": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "BarChartData": {
            "data": [
                5
            ],
            "indexBy": [
                1
            ],
            "keys": [
                1
            ],
            "series": [
                311
            ],
            "xAxisLabel": [
                1
            ],
            "yAxisLabel": [
                1
            ],
            "showLegend": [
                3
            ],
            "showDataLabels": [
                3
            ],
            "layout": [
                101
            ],
            "groupMode": [
                100
            ],
            "hasTooManyGroups": [
                3
            ],
            "formattedToRawLookup": [
                5
            ],
            "__typename": [
                1
            ]
        },
        "LineChartDataPoint": {
            "x": [
                1
            ],
            "y": [
                16
            ],
            "__typename": [
                1
            ]
        },
        "LineChartSeries": {
            "key": [
                1
            ],
            "label": [
                1
            ],
            "data": [
                313
            ],
            "__typename": [
                1
            ]
        },
        "LineChartData": {
            "series": [
                314
            ],
            "xAxisLabel": [
                1
            ],
            "yAxisLabel": [
                1
            ],
            "showLegend": [
                3
            ],
            "showDataLabels": [
                3
            ],
            "hasTooManyGroups": [
                3
            ],
            "formattedToRawLookup": [
                5
            ],
            "__typename": [
                1
            ]
        },
        "PieChartDataItem": {
            "key": [
                1
            ],
            "value": [
                16
            ],
            "__typename": [
                1
            ]
        },
        "PieChartData": {
            "data": [
                316
            ],
            "showLegend": [
                3
            ],
            "showDataLabels": [
                3
            ],
            "showCenterMetric": [
                3
            ],
            "hasTooManyGroups": [
                3
            ],
            "formattedToRawLookup": [
                5
            ],
            "__typename": [
                1
            ]
        },
        "DuplicatedDashboard": {
            "id": [
                4
            ],
            "title": [
                1
            ],
            "pageLayoutId": [
                4
            ],
            "position": [
                16
            ],
            "createdAt": [
                1
            ],
            "updatedAt": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "SendEmailOutput": {
            "success": [
                3
            ],
            "error": [
                1
            ],
            "messageThreadId": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "Analytics": {
            "success": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "EventLogRecord": {
            "event": [
                1
            ],
            "timestamp": [
                6
            ],
            "userId": [
                1
            ],
            "properties": [
                5
            ],
            "recordId": [
                1
            ],
            "objectMetadataId": [
                1
            ],
            "isCustom": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "EventLogPageInfo": {
            "endCursor": [
                1
            ],
            "hasNextPage": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "EventLogQueryResult": {
            "records": [
                321
            ],
            "totalCount": [
                30
            ],
            "pageInfo": [
                322
            ],
            "__typename": [
                1
            ]
        },
        "Skill": {
            "id": [
                4
            ],
            "name": [
                1
            ],
            "label": [
                1
            ],
            "icon": [
                1
            ],
            "description": [
                1
            ],
            "content": [
                1
            ],
            "isCustom": [
                3
            ],
            "isActive": [
                3
            ],
            "applicationId": [
                4
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "__typename": [
                1
            ]
        },
        "AgentMessage": {
            "id": [
                4
            ],
            "threadId": [
                4
            ],
            "turnId": [
                4
            ],
            "agentId": [
                4
            ],
            "role": [
                1
            ],
            "status": [
                1
            ],
            "parts": [
                307
            ],
            "processedAt": [
                6
            ],
            "createdAt": [
                6
            ],
            "__typename": [
                1
            ]
        },
        "AgentChatThread": {
            "id": [
                212
            ],
            "title": [
                1
            ],
            "totalInputTokens": [
                30
            ],
            "totalOutputTokens": [
                30
            ],
            "contextWindowTokens": [
                30
            ],
            "conversationSize": [
                30
            ],
            "totalInputCredits": [
                16
            ],
            "totalOutputCredits": [
                16
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "deletedAt": [
                6
            ],
            "lastMessageAt": [
                6
            ],
            "__typename": [
                1
            ]
        },
        "AiSystemPromptSection": {
            "title": [
                1
            ],
            "content": [
                1
            ],
            "estimatedTokenCount": [
                30
            ],
            "__typename": [
                1
            ]
        },
        "AiSystemPromptPreview": {
            "sections": [
                327
            ],
            "estimatedTokenCount": [
                30
            ],
            "__typename": [
                1
            ]
        },
        "ChatStreamError": {
            "code": [
                1
            ],
            "message": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "ChatStreamCatchupChunks": {
            "chunks": [
                5
            ],
            "maxSeq": [
                30
            ],
            "error": [
                329
            ],
            "__typename": [
                1
            ]
        },
        "SendChatMessageResult": {
            "messageId": [
                1
            ],
            "queued": [
                3
            ],
            "streamId": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "AgentChatEvent": {
            "threadId": [
                1
            ],
            "event": [
                5
            ],
            "__typename": [
                1
            ]
        },
        "AgentTurnEvaluation": {
            "id": [
                4
            ],
            "turnId": [
                4
            ],
            "score": [
                30
            ],
            "comment": [
                1
            ],
            "createdAt": [
                6
            ],
            "__typename": [
                1
            ]
        },
        "AgentTurn": {
            "id": [
                4
            ],
            "threadId": [
                4
            ],
            "agentId": [
                4
            ],
            "evaluations": [
                333
            ],
            "messages": [
                325
            ],
            "createdAt": [
                6
            ],
            "__typename": [
                1
            ]
        },
        "WorkspaceAiStats": {
            "conversationsCount": [
                30
            ],
            "skillsCount": [
                30
            ],
            "toolsCount": [
                30
            ],
            "__typename": [
                1
            ]
        },
        "AppKeyValue": {
            "key": [
                1
            ],
            "value": [
                5
            ],
            "scope": [
                337
            ],
            "__typename": [
                1
            ]
        },
        "AppKeyValueScope": {},
        "CalendarChannel": {
            "id": [
                4
            ],
            "handle": [
                1
            ],
            "syncStatus": [
                339
            ],
            "syncStage": [
                340
            ],
            "visibility": [
                341
            ],
            "isContactAutoCreationEnabled": [
                3
            ],
            "contactAutoCreationPolicy": [
                342
            ],
            "isSyncEnabled": [
                3
            ],
            "syncedAt": [
                6
            ],
            "syncStageStartedAt": [
                6
            ],
            "throttleFailureCount": [
                16
            ],
            "connectedAccountId": [
                4
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "__typename": [
                1
            ]
        },
        "CalendarChannelSyncStatus": {},
        "CalendarChannelSyncStage": {},
        "CalendarChannelVisibility": {},
        "CalendarChannelContactAutoCreationPolicy": {},
        "MessageFolder": {
            "id": [
                4
            ],
            "name": [
                1
            ],
            "isSentFolder": [
                3
            ],
            "isSynced": [
                3
            ],
            "parentFolderId": [
                1
            ],
            "externalId": [
                1
            ],
            "pendingSyncAction": [
                344
            ],
            "messageChannelId": [
                4
            ],
            "createdAt": [
                6
            ],
            "updatedAt": [
                6
            ],
            "__typename": [
                1
            ]
        },
        "MessageFolderPendingSyncAction": {},
        "CollectionHash": {
            "collectionName": [
                346
            ],
            "hash": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "AllMetadataName": {},
        "MinimalObjectMetadata": {
            "id": [
                4
            ],
            "nameSingular": [
                1
            ],
            "namePlural": [
                1
            ],
            "labelSingular": [
                1
            ],
            "labelPlural": [
                1
            ],
            "icon": [
                1
            ],
            "color": [
                1
            ],
            "isActive": [
                3
            ],
            "isSystem": [
                3
            ],
            "isRemote": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "MinimalView": {
            "id": [
                4
            ],
            "type": [
                65
            ],
            "key": [
                66
            ],
            "objectMetadataId": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "MinimalMetadata": {
            "objectMetadataItems": [
                347
            ],
            "views": [
                348
            ],
            "collectionHashes": [
                345
            ],
            "__typename": [
                1
            ]
        },
        "Query": {
            "navigationMenuItems": [
                169
            ],
            "navigationMenuItem": [
                169,
                {
                    "id": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "applicationSdkClientChecksums": [
                77,
                {
                    "applicationId": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "enterprisePortalSession": [
                1,
                {
                    "returnUrlPath": [
                        1
                    ]
                }
            ],
            "enterpriseCheckoutSession": [
                1,
                {
                    "billingInterval": [
                        1
                    ]
                }
            ],
            "enterpriseSubscriptionStatus": [
                144
            ],
            "aiProviderCredential": [
                163,
                {
                    "providerName": [
                        1,
                        "String!"
                    ]
                }
            ],
            "getViewFilterGroups": [
                56,
                {
                    "viewId": [
                        1
                    ]
                }
            ],
            "getViewFilterGroup": [
                56,
                {
                    "id": [
                        1,
                        "String!"
                    ]
                }
            ],
            "getViewFilters": [
                58,
                {
                    "viewId": [
                        1
                    ]
                }
            ],
            "getViewFilter": [
                58,
                {
                    "id": [
                        1,
                        "String!"
                    ]
                }
            ],
            "getViews": [
                64,
                {
                    "objectMetadataId": [
                        1
                    ],
                    "viewTypes": [
                        65,
                        "[ViewType!]"
                    ]
                }
            ],
            "getView": [
                64,
                {
                    "id": [
                        1,
                        "String!"
                    ]
                }
            ],
            "getViewSorts": [
                61,
                {
                    "viewId": [
                        1
                    ]
                }
            ],
            "getViewSort": [
                61,
                {
                    "id": [
                        1,
                        "String!"
                    ]
                }
            ],
            "getViewFields": [
                54,
                {
                    "viewId": [
                        1,
                        "String!"
                    ]
                }
            ],
            "getViewField": [
                54,
                {
                    "id": [
                        1,
                        "String!"
                    ]
                }
            ],
            "getViewFieldGroups": [
                63,
                {
                    "viewId": [
                        1,
                        "String!"
                    ]
                }
            ],
            "getViewFieldGroup": [
                63,
                {
                    "id": [
                        1,
                        "String!"
                    ]
                }
            ],
            "apiKeys": [
                7
            ],
            "getApiKeyRoles": [
                49
            ],
            "apiKey": [
                7,
                {
                    "input": [
                        351,
                        "GetApiKeyInput!"
                    ]
                }
            ],
            "getInviteSuggestions": [
                164
            ],
            "applicationConnectionProviders": [
                123,
                {
                    "applicationId": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "billingPortalSession": [
                152,
                {
                    "returnUrlPath": [
                        1
                    ],
                    "forPaymentMethodUpdate": [
                        3
                    ]
                }
            ],
            "listPlans": [
                150
            ],
            "getResourceCreditUsage": [
                149
            ],
            "billingProvider": [
                154
            ],
            "requestPricingCurrency": [
                1
            ],
            "creditPacks": [
                156
            ],
            "engagementPlans": [
                159
            ],
            "creditTransactions": [
                158,
                {
                    "limit": [
                        30
                    ],
                    "cursor": [
                        1
                    ]
                }
            ],
            "workspaceCredits": [
                162
            ],
            "findWorkspaceInvitations": [
                166
            ],
            "getApprovedAccessDomains": [
                145
            ],
            "getPageLayoutTabs": [
                119,
                {
                    "pageLayoutId": [
                        1,
                        "String!"
                    ]
                }
            ],
            "getPageLayoutTab": [
                119,
                {
                    "id": [
                        1,
                        "String!"
                    ]
                }
            ],
            "getPageLayouts": [
                120,
                {
                    "objectMetadataId": [
                        1
                    ],
                    "pageLayoutType": [
                        121
                    ]
                }
            ],
            "getPageLayout": [
                120,
                {
                    "id": [
                        1,
                        "String!"
                    ]
                }
            ],
            "getPageLayoutWidgets": [
                81,
                {
                    "pageLayoutTabId": [
                        1,
                        "String!"
                    ]
                }
            ],
            "getPageLayoutWidget": [
                81,
                {
                    "id": [
                        1,
                        "String!"
                    ]
                }
            ],
            "findManyAgents": [
                11
            ],
            "findOneAgent": [
                11,
                {
                    "input": [
                        352,
                        "AgentIdInput!"
                    ]
                }
            ],
            "objectRecordCounts": [
                231
            ],
            "mostlyEmptyFieldMetadataIds": [
                4,
                {
                    "objectMetadataId": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "object": [
                28,
                {
                    "id": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "objects": [
                235,
                {
                    "paging": [
                        29,
                        "CursorPaging!"
                    ],
                    "filter": [
                        353,
                        "ObjectFilter!"
                    ]
                }
            ],
            "findOneLogicFunction": [
                22,
                {
                    "input": [
                        354,
                        "LogicFunctionIdInput!"
                    ]
                }
            ],
            "findManyLogicFunctions": [
                22
            ],
            "getAvailablePackages": [
                5,
                {
                    "input": [
                        354,
                        "LogicFunctionIdInput!"
                    ]
                }
            ],
            "getLogicFunctionSourceCode": [
                1,
                {
                    "input": [
                        354,
                        "LogicFunctionIdInput!"
                    ]
                }
            ],
            "commandMenuItems": [
                15
            ],
            "commandMenuItem": [
                15,
                {
                    "id": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "frontComponents": [
                14
            ],
            "frontComponent": [
                14,
                {
                    "id": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "currentWorkspace": [
                70
            ],
            "getPublicWorkspaceDataByDomain": [
                190,
                {
                    "origin": [
                        1
                    ]
                }
            ],
            "getPublicWorkspaceDataById": [
                191,
                {
                    "id": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "findApplicationRegistrationByClientId": [
                209,
                {
                    "clientId": [
                        1,
                        "String!"
                    ]
                }
            ],
            "findApplicationRegistrationByUniversalIdentifier": [
                76,
                {
                    "universalIdentifier": [
                        1,
                        "String!"
                    ]
                }
            ],
            "findManyApplicationRegistrations": [
                76
            ],
            "findOneApplicationRegistration": [
                76,
                {
                    "id": [
                        1,
                        "String!"
                    ]
                }
            ],
            "findApplicationRegistrationStats": [
                183,
                {
                    "id": [
                        1,
                        "String!"
                    ]
                }
            ],
            "findApplicationRegistrationVariables": [
                181,
                {
                    "applicationRegistrationId": [
                        1,
                        "String!"
                    ]
                }
            ],
            "applicationRegistrationTarballUrl": [
                1,
                {
                    "id": [
                        1,
                        "String!"
                    ]
                }
            ],
            "findClaimableApplicationRegistration": [
                207,
                {
                    "sourcePackage": [
                        1
                    ],
                    "universalIdentifier": [
                        1
                    ]
                }
            ],
            "githubClaimAuthorizationUrl": [
                1,
                {
                    "applicationRegistrationId": [
                        1,
                        "String!"
                    ]
                }
            ],
            "findManyApplications": [
                50
            ],
            "findOneApplication": [
                50,
                {
                    "id": [
                        4
                    ],
                    "universalIdentifier": [
                        4
                    ]
                }
            ],
            "findManyMarketplaceApps": [
                223,
                {
                    "universalIdentifiers": [
                        1,
                        "[String!]"
                    ]
                }
            ],
            "findMarketplaceAppDetail": [
                227,
                {
                    "universalIdentifier": [
                        1,
                        "String!"
                    ]
                }
            ],
            "publicMarketplaceApps": [
                223,
                {
                    "isVetted": [
                        3,
                        "Boolean!"
                    ]
                }
            ],
            "publicMarketplaceAppDetail": [
                227,
                {
                    "universalIdentifier": [
                        1,
                        "String!"
                    ]
                }
            ],
            "field": [
                24,
                {
                    "id": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "fields": [
                240,
                {
                    "paging": [
                        29,
                        "CursorPaging!"
                    ],
                    "filter": [
                        32,
                        "FieldFilter!"
                    ]
                }
            ],
            "getViewGroups": [
                60,
                {
                    "viewId": [
                        1
                    ]
                }
            ],
            "getViewGroup": [
                60,
                {
                    "id": [
                        1,
                        "String!"
                    ]
                }
            ],
            "getRoles": [
                49
            ],
            "previewMessageCampaignAudience": [
                299,
                {
                    "input": [
                        355,
                        "PreviewMessageCampaignAudienceInput!"
                    ]
                }
            ],
            "unsubscribeTopics": [
                303
            ],
            "unsubscribePagePreviewUrl": [
                1
            ],
            "myMessageChannels": [
                290,
                {
                    "connectedAccountId": [
                        4
                    ]
                }
            ],
            "getEmailingDomains": [
                281
            ],
            "myConnectedAccounts": [
                250
            ],
            "getToolIndex": [
                306
            ],
            "getToolInputSchema": [
                5,
                {
                    "toolName": [
                        1,
                        "String!"
                    ]
                }
            ],
            "webhooks": [
                305
            ],
            "webhook": [
                305,
                {
                    "id": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "myMessageFolders": [
                343,
                {
                    "messageChannelId": [
                        4
                    ]
                }
            ],
            "myCalendarChannels": [
                338,
                {
                    "connectedAccountId": [
                        4
                    ]
                }
            ],
            "minimalMetadata": [
                349
            ],
            "appKeyValue": [
                336,
                {
                    "key": [
                        1,
                        "String!"
                    ],
                    "scope": [
                        337
                    ]
                }
            ],
            "appConnections": [
                211,
                {
                    "filter": [
                        356
                    ]
                }
            ],
            "appConnection": [
                211,
                {
                    "id": [
                        212,
                        "ID!"
                    ]
                }
            ],
            "findWorkspaceAiStats": [
                335
            ],
            "chatThreads": [
                326
            ],
            "chatThread": [
                326,
                {
                    "id": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "chatMessages": [
                325,
                {
                    "threadId": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "chatStreamCatchupChunks": [
                330,
                {
                    "threadId": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "getAiSystemPromptPreview": [
                328
            ],
            "skills": [
                324
            ],
            "skill": [
                324,
                {
                    "id": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "agentTurns": [
                334,
                {
                    "agentId": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "checkUserExists": [
                270,
                {
                    "email": [
                        1,
                        "String!"
                    ],
                    "captchaToken": [
                        1
                    ]
                }
            ],
            "checkWorkspaceInviteHashIsValid": [
                271,
                {
                    "inviteHash": [
                        1,
                        "String!"
                    ]
                }
            ],
            "findWorkspaceFromInviteHash": [
                70,
                {
                    "inviteHash": [
                        1,
                        "String!"
                    ]
                }
            ],
            "checkWorkspaceSubdomainAvailability": [
                265,
                {
                    "subdomain": [
                        1,
                        "String!"
                    ]
                }
            ],
            "getWorkspaceCreationDefaults": [
                266
            ],
            "validatePasswordResetToken": [
                263,
                {
                    "passwordResetToken": [
                        1,
                        "String!"
                    ]
                }
            ],
            "currentUser": [
                73
            ],
            "getSSOIdentityProviders": [
                217
            ],
            "eventLogs": [
                323,
                {
                    "input": [
                        357,
                        "EventLogQueryInput!"
                    ]
                }
            ],
            "pieChartData": [
                317,
                {
                    "input": [
                        361,
                        "PieChartDataInput!"
                    ]
                }
            ],
            "lineChartData": [
                315,
                {
                    "input": [
                        362,
                        "LineChartDataInput!"
                    ]
                }
            ],
            "barChartData": [
                312,
                {
                    "input": [
                        363,
                        "BarChartDataInput!"
                    ]
                }
            ],
            "getConnectedImapSmtpCaldavAccount": [
                288,
                {
                    "id": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "getAutoCompleteAddress": [
                283,
                {
                    "address": [
                        1,
                        "String!"
                    ],
                    "token": [
                        1,
                        "String!"
                    ],
                    "country": [
                        1
                    ],
                    "isFieldCity": [
                        3
                    ]
                }
            ],
            "getAddressDetails": [
                285,
                {
                    "placeId": [
                        1,
                        "String!"
                    ],
                    "token": [
                        1,
                        "String!"
                    ]
                }
            ],
            "getUsageAnalytics": [
                275,
                {
                    "input": [
                        364
                    ]
                }
            ],
            "findManyPublicDomains": [
                279
            ],
            "__typename": [
                1
            ]
        },
        "GetApiKeyInput": {
            "id": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "AgentIdInput": {
            "id": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "ObjectFilter": {
            "and": [
                353
            ],
            "or": [
                353
            ],
            "id": [
                33
            ],
            "isRemote": [
                34
            ],
            "isActive": [
                34
            ],
            "isSystem": [
                34
            ],
            "isUIEditable": [
                34
            ],
            "isUICreatable": [
                34
            ],
            "isUIReadOnly": [
                34
            ],
            "isSearchable": [
                34
            ],
            "__typename": [
                1
            ]
        },
        "LogicFunctionIdInput": {
            "id": [
                212
            ],
            "__typename": [
                1
            ]
        },
        "PreviewMessageCampaignAudienceInput": {
            "listId": [
                1
            ],
            "unsubscribeTopicId": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "ListAppConnectionsInput": {
            "providerName": [
                1
            ],
            "userWorkspaceId": [
                1
            ],
            "visibility": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "EventLogQueryInput": {
            "table": [
                358
            ],
            "filters": [
                359
            ],
            "first": [
                30
            ],
            "after": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "EventLogTable": {},
        "EventLogFiltersInput": {
            "eventType": [
                1
            ],
            "userWorkspaceId": [
                1
            ],
            "dateRange": [
                360
            ],
            "recordId": [
                1
            ],
            "objectMetadataId": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "EventLogDateRangeInput": {
            "start": [
                6
            ],
            "end": [
                6
            ],
            "__typename": [
                1
            ]
        },
        "PieChartDataInput": {
            "objectMetadataId": [
                4
            ],
            "configuration": [
                5
            ],
            "__typename": [
                1
            ]
        },
        "LineChartDataInput": {
            "objectMetadataId": [
                4
            ],
            "configuration": [
                5
            ],
            "__typename": [
                1
            ]
        },
        "BarChartDataInput": {
            "objectMetadataId": [
                4
            ],
            "configuration": [
                5
            ],
            "__typename": [
                1
            ]
        },
        "UsageAnalyticsInput": {
            "periodStart": [
                6
            ],
            "periodEnd": [
                6
            ],
            "userWorkspaceId": [
                1
            ],
            "operationTypes": [
                365
            ],
            "__typename": [
                1
            ]
        },
        "UsageOperationType": {},
        "Mutation": {
            "addQueryToEventStream": [
                3,
                {
                    "input": [
                        367,
                        "AddQuerySubscriptionInput!"
                    ]
                }
            ],
            "removeQueryFromEventStream": [
                3,
                {
                    "input": [
                        368,
                        "RemoveQueryFromEventStreamInput!"
                    ]
                }
            ],
            "createManyNavigationMenuItems": [
                169,
                {
                    "inputs": [
                        369,
                        "[CreateNavigationMenuItemInput!]!"
                    ]
                }
            ],
            "createNavigationMenuItem": [
                169,
                {
                    "input": [
                        369,
                        "CreateNavigationMenuItemInput!"
                    ]
                }
            ],
            "updateManyNavigationMenuItems": [
                169,
                {
                    "inputs": [
                        370,
                        "[UpdateOneNavigationMenuItemInput!]!"
                    ]
                }
            ],
            "updateNavigationMenuItem": [
                169,
                {
                    "input": [
                        370,
                        "UpdateOneNavigationMenuItemInput!"
                    ]
                }
            ],
            "deleteManyNavigationMenuItems": [
                169,
                {
                    "ids": [
                        4,
                        "[UUID!]!"
                    ]
                }
            ],
            "deleteNavigationMenuItem": [
                169,
                {
                    "id": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "createFileUpload": [
                147,
                {
                    "filename": [
                        1,
                        "String!"
                    ],
                    "size": [
                        16,
                        "Float!"
                    ],
                    "fileFolder": [
                        372,
                        "FileFolder!"
                    ],
                    "fieldMetadataId": [
                        1
                    ],
                    "fieldMetadataUniversalIdentifier": [
                        1
                    ]
                }
            ],
            "completeFileUpload": [
                146,
                {
                    "fileId": [
                        1,
                        "String!"
                    ]
                }
            ],
            "refreshEnterpriseValidityToken": [
                3
            ],
            "releaseEnterpriseServerBinding": [
                143
            ],
            "setEnterpriseKey": [
                143,
                {
                    "enterpriseKey": [
                        1,
                        "String!"
                    ]
                }
            ],
            "uploadEmailAttachmentFile": [
                146,
                {
                    "file": [
                        373,
                        "Upload!"
                    ]
                }
            ],
            "uploadAiChatFile": [
                146,
                {
                    "file": [
                        373,
                        "Upload!"
                    ]
                }
            ],
            "uploadWorkflowFile": [
                146,
                {
                    "file": [
                        373,
                        "Upload!"
                    ]
                }
            ],
            "uploadWorkspaceLogo": [
                146,
                {
                    "file": [
                        373,
                        "Upload!"
                    ]
                }
            ],
            "uploadWorkspaceMemberProfilePicture": [
                146,
                {
                    "file": [
                        373,
                        "Upload!"
                    ]
                }
            ],
            "uploadFilesFieldFile": [
                146,
                {
                    "file": [
                        373,
                        "Upload!"
                    ],
                    "fieldMetadataId": [
                        1,
                        "String!"
                    ]
                }
            ],
            "uploadFilesFieldFileByUniversalIdentifier": [
                146,
                {
                    "file": [
                        373,
                        "Upload!"
                    ],
                    "fieldMetadataUniversalIdentifier": [
                        1,
                        "String!"
                    ]
                }
            ],
            "upsertAiProviderCredential": [
                163,
                {
                    "input": [
                        374,
                        "UpsertAiProviderCredentialInput!"
                    ]
                }
            ],
            "createViewFilterGroup": [
                56,
                {
                    "input": [
                        375,
                        "CreateViewFilterGroupInput!"
                    ]
                }
            ],
            "updateViewFilterGroup": [
                56,
                {
                    "id": [
                        1,
                        "String!"
                    ],
                    "input": [
                        376,
                        "UpdateViewFilterGroupInput!"
                    ]
                }
            ],
            "deleteViewFilterGroup": [
                3,
                {
                    "id": [
                        1,
                        "String!"
                    ]
                }
            ],
            "destroyViewFilterGroup": [
                3,
                {
                    "id": [
                        1,
                        "String!"
                    ]
                }
            ],
            "createViewFilter": [
                58,
                {
                    "input": [
                        377,
                        "CreateViewFilterInput!"
                    ]
                }
            ],
            "updateViewFilter": [
                58,
                {
                    "input": [
                        378,
                        "UpdateViewFilterInput!"
                    ]
                }
            ],
            "deleteViewFilter": [
                58,
                {
                    "input": [
                        380,
                        "DeleteViewFilterInput!"
                    ]
                }
            ],
            "destroyViewFilter": [
                58,
                {
                    "input": [
                        381,
                        "DestroyViewFilterInput!"
                    ]
                }
            ],
            "createView": [
                64,
                {
                    "input": [
                        382,
                        "CreateViewInput!"
                    ]
                }
            ],
            "updateView": [
                64,
                {
                    "id": [
                        1,
                        "String!"
                    ],
                    "input": [
                        383,
                        "UpdateViewInput!"
                    ]
                }
            ],
            "deleteView": [
                3,
                {
                    "id": [
                        1,
                        "String!"
                    ]
                }
            ],
            "destroyView": [
                3,
                {
                    "id": [
                        1,
                        "String!"
                    ]
                }
            ],
            "upsertViewWidget": [
                64,
                {
                    "input": [
                        384,
                        "UpsertViewWidgetInput!"
                    ]
                }
            ],
            "createViewSort": [
                61,
                {
                    "input": [
                        390,
                        "CreateViewSortInput!"
                    ]
                }
            ],
            "updateViewSort": [
                61,
                {
                    "input": [
                        391,
                        "UpdateViewSortInput!"
                    ]
                }
            ],
            "deleteViewSort": [
                3,
                {
                    "input": [
                        393,
                        "DeleteViewSortInput!"
                    ]
                }
            ],
            "destroyViewSort": [
                3,
                {
                    "input": [
                        394,
                        "DestroyViewSortInput!"
                    ]
                }
            ],
            "updateViewField": [
                54,
                {
                    "input": [
                        395,
                        "UpdateViewFieldInput!"
                    ]
                }
            ],
            "createViewField": [
                54,
                {
                    "input": [
                        397,
                        "CreateViewFieldInput!"
                    ]
                }
            ],
            "createManyViewFields": [
                54,
                {
                    "inputs": [
                        397,
                        "[CreateViewFieldInput!]!"
                    ]
                }
            ],
            "deleteViewField": [
                54,
                {
                    "input": [
                        398,
                        "DeleteViewFieldInput!"
                    ]
                }
            ],
            "destroyViewField": [
                54,
                {
                    "input": [
                        399,
                        "DestroyViewFieldInput!"
                    ]
                }
            ],
            "updateViewFieldGroup": [
                63,
                {
                    "input": [
                        400,
                        "UpdateViewFieldGroupInput!"
                    ]
                }
            ],
            "createViewFieldGroup": [
                63,
                {
                    "input": [
                        402,
                        "CreateViewFieldGroupInput!"
                    ]
                }
            ],
            "createManyViewFieldGroups": [
                63,
                {
                    "inputs": [
                        402,
                        "[CreateViewFieldGroupInput!]!"
                    ]
                }
            ],
            "deleteViewFieldGroup": [
                63,
                {
                    "input": [
                        403,
                        "DeleteViewFieldGroupInput!"
                    ]
                }
            ],
            "destroyViewFieldGroup": [
                63,
                {
                    "input": [
                        404,
                        "DestroyViewFieldGroupInput!"
                    ]
                }
            ],
            "upsertFieldsWidget": [
                64,
                {
                    "input": [
                        405,
                        "UpsertFieldsWidgetInput!"
                    ]
                }
            ],
            "createApiKey": [
                7,
                {
                    "input": [
                        408,
                        "CreateApiKeyInput!"
                    ]
                }
            ],
            "updateApiKey": [
                7,
                {
                    "input": [
                        409,
                        "UpdateApiKeyInput!"
                    ]
                }
            ],
            "revokeApiKey": [
                7,
                {
                    "input": [
                        410,
                        "RevokeApiKeyInput!"
                    ]
                }
            ],
            "assignRoleToApiKey": [
                3,
                {
                    "apiKeyId": [
                        4,
                        "UUID!"
                    ],
                    "roleId": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "skipSyncEmailOnboardingStep": [
                165
            ],
            "triggerInstallAppsOnboardingStep": [
                165,
                {
                    "universalIdentifiers": [
                        1,
                        "[String!]!"
                    ]
                }
            ],
            "updateOneApplicationVariable": [
                3,
                {
                    "key": [
                        1,
                        "String!"
                    ],
                    "value": [
                        1,
                        "String!"
                    ],
                    "applicationId": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "checkoutSession": [
                152,
                {
                    "recurringInterval": [
                        131,
                        "SubscriptionInterval!"
                    ],
                    "plan": [
                        127,
                        "BillingPlanKey!"
                    ],
                    "requirePaymentMethod": [
                        3,
                        "Boolean!"
                    ],
                    "successUrlPath": [
                        1
                    ],
                    "successReturnUrl": [
                        1
                    ],
                    "razorpayPlanId": [
                        1
                    ],
                    "quantity": [
                        30
                    ]
                }
            ],
            "createSubscriptionPaymentIntent": [
                151,
                {
                    "recurringInterval": [
                        131,
                        "SubscriptionInterval!"
                    ],
                    "plan": [
                        127,
                        "BillingPlanKey!"
                    ],
                    "requirePaymentMethod": [
                        3,
                        "Boolean!"
                    ],
                    "successUrlPath": [
                        1
                    ],
                    "successReturnUrl": [
                        1
                    ],
                    "razorpayPlanId": [
                        1
                    ],
                    "quantity": [
                        30
                    ],
                    "idempotencyKey": [
                        1,
                        "String!"
                    ]
                }
            ],
            "createBillingPaymentMethodSetupIntent": [
                151
            ],
            "switchSubscriptionInterval": [
                153
            ],
            "switchBillingPlan": [
                153
            ],
            "cancelSwitchBillingPlan": [
                153
            ],
            "cancelSwitchBillingInterval": [
                153
            ],
            "setResourceCreditSubscriptionPrice": [
                153,
                {
                    "priceId": [
                        1,
                        "String!"
                    ]
                }
            ],
            "endSubscriptionTrialPeriod": [
                148
            ],
            "cancelSwitchResourceCreditPrice": [
                153
            ],
            "createRazorpayOrderForCredits": [
                160,
                {
                    "input": [
                        411,
                        "CreateRazorpayOrderInput!"
                    ]
                }
            ],
            "requestInvoiceForCredits": [
                161,
                {
                    "input": [
                        412,
                        "RequestInvoiceForCreditsInput!"
                    ]
                }
            ],
            "deleteWorkspaceInvitation": [
                1,
                {
                    "appTokenId": [
                        1,
                        "String!"
                    ]
                }
            ],
            "resendWorkspaceInvitation": [
                167,
                {
                    "appTokenId": [
                        1,
                        "String!"
                    ]
                }
            ],
            "sendInvitations": [
                167,
                {
                    "emails": [
                        1,
                        "[String!]!"
                    ],
                    "roleId": [
                        4
                    ]
                }
            ],
            "createApprovedAccessDomain": [
                145,
                {
                    "input": [
                        413,
                        "CreateApprovedAccessDomainInput!"
                    ]
                }
            ],
            "deleteApprovedAccessDomain": [
                3,
                {
                    "input": [
                        414,
                        "DeleteApprovedAccessDomainInput!"
                    ]
                }
            ],
            "validateApprovedAccessDomain": [
                145,
                {
                    "input": [
                        415,
                        "ValidateApprovedAccessDomainInput!"
                    ]
                }
            ],
            "createPageLayoutTab": [
                119,
                {
                    "input": [
                        416,
                        "CreatePageLayoutTabInput!"
                    ]
                }
            ],
            "updatePageLayoutTab": [
                119,
                {
                    "id": [
                        1,
                        "String!"
                    ],
                    "input": [
                        417,
                        "UpdatePageLayoutTabInput!"
                    ]
                }
            ],
            "destroyPageLayoutTab": [
                3,
                {
                    "id": [
                        1,
                        "String!"
                    ]
                }
            ],
            "createPageLayout": [
                120,
                {
                    "input": [
                        418,
                        "CreatePageLayoutInput!"
                    ]
                }
            ],
            "updatePageLayout": [
                120,
                {
                    "id": [
                        1,
                        "String!"
                    ],
                    "input": [
                        419,
                        "UpdatePageLayoutInput!"
                    ]
                }
            ],
            "destroyPageLayout": [
                3,
                {
                    "id": [
                        1,
                        "String!"
                    ]
                }
            ],
            "updatePageLayoutWithTabsAndWidgets": [
                120,
                {
                    "id": [
                        1,
                        "String!"
                    ],
                    "input": [
                        420,
                        "UpdatePageLayoutWithTabsInput!"
                    ]
                }
            ],
            "resetPageLayoutToDefault": [
                120,
                {
                    "id": [
                        1,
                        "String!"
                    ]
                }
            ],
            "resetPageLayoutWidgetToDefault": [
                81,
                {
                    "id": [
                        1,
                        "String!"
                    ]
                }
            ],
            "resetPageLayoutTabToDefault": [
                119,
                {
                    "id": [
                        1,
                        "String!"
                    ]
                }
            ],
            "createPageLayoutWidget": [
                81,
                {
                    "input": [
                        424,
                        "CreatePageLayoutWidgetInput!"
                    ]
                }
            ],
            "updatePageLayoutWidget": [
                81,
                {
                    "id": [
                        1,
                        "String!"
                    ],
                    "input": [
                        425,
                        "UpdatePageLayoutWidgetInput!"
                    ]
                }
            ],
            "destroyPageLayoutWidget": [
                3,
                {
                    "id": [
                        1,
                        "String!"
                    ]
                }
            ],
            "createOneAgent": [
                11,
                {
                    "input": [
                        426,
                        "CreateAgentInput!"
                    ]
                }
            ],
            "updateOneAgent": [
                11,
                {
                    "input": [
                        427,
                        "UpdateAgentInput!"
                    ]
                }
            ],
            "deleteOneAgent": [
                11,
                {
                    "input": [
                        352,
                        "AgentIdInput!"
                    ]
                }
            ],
            "createOneObject": [
                28,
                {
                    "input": [
                        428,
                        "CreateOneObjectInput!"
                    ]
                }
            ],
            "deleteOneObject": [
                28,
                {
                    "input": [
                        430,
                        "DeleteOneObjectInput!"
                    ]
                }
            ],
            "updateOneObject": [
                28,
                {
                    "input": [
                        431,
                        "UpdateOneObjectInput!"
                    ]
                }
            ],
            "createOneIndex": [
                26,
                {
                    "input": [
                        433,
                        "CreateOneIndexInput!"
                    ]
                }
            ],
            "deleteOneIndex": [
                26,
                {
                    "input": [
                        436,
                        "DeleteOneIndexInput!"
                    ]
                }
            ],
            "deleteOneLogicFunction": [
                22,
                {
                    "input": [
                        354,
                        "LogicFunctionIdInput!"
                    ]
                }
            ],
            "createOneLogicFunction": [
                22,
                {
                    "input": [
                        437,
                        "CreateLogicFunctionFromSourceInput!"
                    ]
                }
            ],
            "executeOneLogicFunction": [
                141,
                {
                    "input": [
                        438,
                        "ExecuteOneLogicFunctionInput!"
                    ]
                }
            ],
            "updateOneLogicFunction": [
                3,
                {
                    "input": [
                        439,
                        "UpdateLogicFunctionFromSourceInput!"
                    ]
                }
            ],
            "createCommandMenuItem": [
                15,
                {
                    "input": [
                        441,
                        "CreateCommandMenuItemInput!"
                    ]
                }
            ],
            "updateCommandMenuItem": [
                15,
                {
                    "input": [
                        442,
                        "UpdateCommandMenuItemInput!"
                    ]
                }
            ],
            "resetCommandMenuItem": [
                15,
                {
                    "id": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "deleteCommandMenuItem": [
                15,
                {
                    "id": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "createFrontComponent": [
                14,
                {
                    "input": [
                        443,
                        "CreateFrontComponentInput!"
                    ]
                }
            ],
            "updateFrontComponent": [
                14,
                {
                    "input": [
                        444,
                        "UpdateFrontComponentInput!"
                    ]
                }
            ],
            "deleteFrontComponent": [
                14,
                {
                    "id": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "activateWorkspace": [
                70,
                {
                    "data": [
                        446,
                        "ActivateWorkspaceInput!"
                    ]
                }
            ],
            "updateWorkspace": [
                70,
                {
                    "data": [
                        447,
                        "UpdateWorkspaceInput!"
                    ]
                }
            ],
            "deleteCurrentWorkspace": [
                70
            ],
            "checkCustomDomainValidRecords": [
                244
            ],
            "upgradeApplication": [
                3,
                {
                    "appRegistrationId": [
                        1,
                        "String!"
                    ],
                    "targetVersion": [
                        1,
                        "String!"
                    ]
                }
            ],
            "createApplicationRegistration": [
                208,
                {
                    "input": [
                        448,
                        "CreateApplicationRegistrationInput!"
                    ]
                }
            ],
            "updateApplicationRegistration": [
                76,
                {
                    "input": [
                        449,
                        "UpdateApplicationRegistrationInput!"
                    ]
                }
            ],
            "deleteApplicationRegistration": [
                3,
                {
                    "id": [
                        1,
                        "String!"
                    ]
                }
            ],
            "rotateApplicationRegistrationClientSecret": [
                210,
                {
                    "id": [
                        1,
                        "String!"
                    ]
                }
            ],
            "createApplicationRegistrationVariable": [
                2,
                {
                    "input": [
                        451,
                        "CreateApplicationRegistrationVariableInput!"
                    ]
                }
            ],
            "updateApplicationRegistrationVariable": [
                2,
                {
                    "input": [
                        452,
                        "UpdateApplicationRegistrationVariableInput!"
                    ]
                }
            ],
            "deleteApplicationRegistrationVariable": [
                3,
                {
                    "id": [
                        1,
                        "String!"
                    ]
                }
            ],
            "uploadAppTarball": [
                76,
                {
                    "file": [
                        373,
                        "Upload!"
                    ],
                    "universalIdentifier": [
                        1
                    ]
                }
            ],
            "claimApplicationRegistrationOwnership": [
                76,
                {
                    "applicationRegistrationId": [
                        1,
                        "String!"
                    ]
                }
            ],
            "transferApplicationRegistrationOwnership": [
                76,
                {
                    "applicationRegistrationId": [
                        1,
                        "String!"
                    ],
                    "targetWorkspaceSubdomain": [
                        1,
                        "String!"
                    ]
                }
            ],
            "installMarketplaceApp": [
                3,
                {
                    "universalIdentifier": [
                        1,
                        "String!"
                    ],
                    "version": [
                        1
                    ]
                }
            ],
            "installApplication": [
                50,
                {
                    "universalIdentifier": [
                        1,
                        "String!"
                    ],
                    "version": [
                        1
                    ]
                }
            ],
            "updateApplication": [
                50,
                {
                    "id": [
                        4,
                        "UUID!"
                    ],
                    "input": [
                        454,
                        "UpdateApplicationInput!"
                    ]
                }
            ],
            "uninstallApplication": [
                3,
                {
                    "universalIdentifier": [
                        1,
                        "String!"
                    ]
                }
            ],
            "syncMarketplaceCatalog": [
                3
            ],
            "createOneField": [
                24,
                {
                    "input": [
                        455,
                        "CreateOneFieldMetadataInput!"
                    ]
                }
            ],
            "updateOneField": [
                24,
                {
                    "input": [
                        457,
                        "UpdateOneFieldMetadataInput!"
                    ]
                }
            ],
            "deleteOneField": [
                24,
                {
                    "input": [
                        459,
                        "DeleteOneFieldInput!"
                    ]
                }
            ],
            "createViewGroup": [
                60,
                {
                    "input": [
                        460,
                        "CreateViewGroupInput!"
                    ]
                }
            ],
            "createManyViewGroups": [
                60,
                {
                    "inputs": [
                        460,
                        "[CreateViewGroupInput!]!"
                    ]
                }
            ],
            "updateViewGroup": [
                60,
                {
                    "input": [
                        461,
                        "UpdateViewGroupInput!"
                    ]
                }
            ],
            "updateManyViewGroups": [
                60,
                {
                    "inputs": [
                        461,
                        "[UpdateViewGroupInput!]!"
                    ]
                }
            ],
            "deleteViewGroup": [
                60,
                {
                    "input": [
                        463,
                        "DeleteViewGroupInput!"
                    ]
                }
            ],
            "destroyViewGroup": [
                60,
                {
                    "input": [
                        464,
                        "DestroyViewGroupInput!"
                    ]
                }
            ],
            "updateWorkspaceMemberRole": [
                37,
                {
                    "workspaceMemberId": [
                        4,
                        "UUID!"
                    ],
                    "roleId": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "createOneRole": [
                49,
                {
                    "createRoleInput": [
                        465,
                        "CreateRoleInput!"
                    ]
                }
            ],
            "updateOneRole": [
                49,
                {
                    "updateRoleInput": [
                        466,
                        "UpdateRoleInput!"
                    ]
                }
            ],
            "deleteOneRole": [
                1,
                {
                    "roleId": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "upsertObjectPermissions": [
                46,
                {
                    "upsertObjectPermissionsInput": [
                        468,
                        "UpsertObjectPermissionsInput!"
                    ]
                }
            ],
            "upsertPermissionFlags": [
                47,
                {
                    "upsertPermissionFlagsInput": [
                        470,
                        "UpsertPermissionFlagsInput!"
                    ]
                }
            ],
            "upsertFieldPermissions": [
                41,
                {
                    "upsertFieldPermissionsInput": [
                        471,
                        "UpsertFieldPermissionsInput!"
                    ]
                }
            ],
            "upsertRowLevelPermissionPredicates": [
                245,
                {
                    "input": [
                        473,
                        "UpsertRowLevelPermissionPredicatesInput!"
                    ]
                }
            ],
            "assignRoleToAgent": [
                3,
                {
                    "agentId": [
                        4,
                        "UUID!"
                    ],
                    "roleId": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "removeRoleFromAgent": [
                3,
                {
                    "agentId": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "sendEmailViaEmailingDomain": [
                300,
                {
                    "input": [
                        476,
                        "SendEmailViaDomainInput!"
                    ]
                }
            ],
            "sendMessageCampaign": [
                302,
                {
                    "input": [
                        477,
                        "SendMessageCampaignInput!"
                    ]
                }
            ],
            "createUnsubscribeTopic": [
                303,
                {
                    "input": [
                        478,
                        "CreateUnsubscribeTopicInput!"
                    ]
                }
            ],
            "updateUnsubscribeTopic": [
                303,
                {
                    "input": [
                        479,
                        "UpdateUnsubscribeTopicInput!"
                    ]
                }
            ],
            "deleteUnsubscribeTopic": [
                3,
                {
                    "id": [
                        1,
                        "String!"
                    ]
                }
            ],
            "updateMessageChannel": [
                290,
                {
                    "input": [
                        480,
                        "UpdateMessageChannelInput!"
                    ]
                }
            ],
            "createEmailGroupChannel": [
                298,
                {
                    "input": [
                        482,
                        "CreateEmailGroupChannelInput!"
                    ]
                }
            ],
            "deleteEmailGroupChannel": [
                290,
                {
                    "id": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "createEmailingDomain": [
                281,
                {
                    "input": [
                        483,
                        "CreateEmailingDomainInput!"
                    ]
                }
            ],
            "deleteEmailingDomain": [
                3,
                {
                    "id": [
                        1,
                        "String!"
                    ]
                }
            ],
            "verifyEmailingDomain": [
                281,
                {
                    "id": [
                        1,
                        "String!"
                    ]
                }
            ],
            "deleteConnectedAccount": [
                250,
                {
                    "id": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "runAgent": [
                308,
                {
                    "input": [
                        484,
                        "RunAgentInput!"
                    ]
                }
            ],
            "createWebhook": [
                305,
                {
                    "input": [
                        485,
                        "CreateWebhookInput!"
                    ]
                }
            ],
            "updateWebhook": [
                305,
                {
                    "input": [
                        486,
                        "UpdateWebhookInput!"
                    ]
                }
            ],
            "deleteWebhook": [
                305,
                {
                    "id": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "updateMessageFolder": [
                343,
                {
                    "input": [
                        488,
                        "UpdateMessageFolderInput!"
                    ]
                }
            ],
            "updateMessageFolders": [
                343,
                {
                    "input": [
                        490,
                        "UpdateMessageFoldersInput!"
                    ]
                }
            ],
            "updateCalendarChannel": [
                338,
                {
                    "input": [
                        491,
                        "UpdateCalendarChannelInput!"
                    ]
                }
            ],
            "setAppKeyValue": [
                336,
                {
                    "input": [
                        493,
                        "SetAppKeyValueInput!"
                    ]
                }
            ],
            "deleteAppKeyValue": [
                3,
                {
                    "key": [
                        1,
                        "String!"
                    ],
                    "scope": [
                        337
                    ]
                }
            ],
            "createChatThread": [
                326
            ],
            "sendChatMessage": [
                331,
                {
                    "threadId": [
                        4,
                        "UUID!"
                    ],
                    "text": [
                        1,
                        "String!"
                    ],
                    "messageId": [
                        4,
                        "UUID!"
                    ],
                    "browsingContext": [
                        5
                    ],
                    "modelId": [
                        1
                    ],
                    "fileAttachments": [
                        494,
                        "[FileAttachmentInput!]"
                    ]
                }
            ],
            "retryChatMessage": [
                331,
                {
                    "threadId": [
                        4,
                        "UUID!"
                    ],
                    "modelId": [
                        1
                    ]
                }
            ],
            "answerAgentChatQuestion": [
                331,
                {
                    "threadId": [
                        4,
                        "UUID!"
                    ],
                    "messageId": [
                        4,
                        "UUID!"
                    ],
                    "answers": [
                        495,
                        "[AgentChatQuestionAnswerInput!]!"
                    ],
                    "modelId": [
                        1
                    ]
                }
            ],
            "stopAgentChatStream": [
                3,
                {
                    "threadId": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "renameChatThread": [
                326,
                {
                    "id": [
                        4,
                        "UUID!"
                    ],
                    "title": [
                        1,
                        "String!"
                    ]
                }
            ],
            "archiveChatThread": [
                326,
                {
                    "id": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "unarchiveChatThread": [
                326,
                {
                    "id": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "deleteChatThread": [
                3,
                {
                    "id": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "deleteQueuedChatMessage": [
                3,
                {
                    "messageId": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "createSkill": [
                324,
                {
                    "input": [
                        496,
                        "CreateSkillInput!"
                    ]
                }
            ],
            "updateSkill": [
                324,
                {
                    "input": [
                        497,
                        "UpdateSkillInput!"
                    ]
                }
            ],
            "deleteSkill": [
                324,
                {
                    "id": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "activateSkill": [
                324,
                {
                    "id": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "deactivateSkill": [
                324,
                {
                    "id": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "evaluateAgentTurn": [
                333,
                {
                    "turnId": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "runEvaluationInput": [
                334,
                {
                    "agentId": [
                        4,
                        "UUID!"
                    ],
                    "input": [
                        1,
                        "String!"
                    ]
                }
            ],
            "getAuthorizationUrlForSSO": [
                258,
                {
                    "input": [
                        498,
                        "GetAuthorizationUrlForSSOInput!"
                    ]
                }
            ],
            "getLoginTokenFromCredentials": [
                269,
                {
                    "email": [
                        1,
                        "String!"
                    ],
                    "password": [
                        1,
                        "String!"
                    ],
                    "captchaToken": [
                        1
                    ],
                    "locale": [
                        1
                    ],
                    "verifyEmailRedirectPath": [
                        1
                    ],
                    "origin": [
                        1,
                        "String!"
                    ]
                }
            ],
            "signIn": [
                256,
                {
                    "email": [
                        1,
                        "String!"
                    ],
                    "password": [
                        1,
                        "String!"
                    ],
                    "captchaToken": [
                        1
                    ],
                    "locale": [
                        1
                    ],
                    "verifyEmailRedirectPath": [
                        1
                    ]
                }
            ],
            "verifyEmailAndGetLoginToken": [
                264,
                {
                    "emailVerificationToken": [
                        1,
                        "String!"
                    ],
                    "email": [
                        1,
                        "String!"
                    ],
                    "captchaToken": [
                        1
                    ],
                    "origin": [
                        1,
                        "String!"
                    ]
                }
            ],
            "verifyEmailAndGetWorkspaceAgnosticToken": [
                256,
                {
                    "emailVerificationToken": [
                        1,
                        "String!"
                    ],
                    "email": [
                        1,
                        "String!"
                    ],
                    "captchaToken": [
                        1
                    ]
                }
            ],
            "getAuthTokensFromOTP": [
                268,
                {
                    "otp": [
                        1,
                        "String!"
                    ],
                    "loginToken": [
                        1,
                        "String!"
                    ],
                    "captchaToken": [
                        1
                    ],
                    "origin": [
                        1,
                        "String!"
                    ]
                }
            ],
            "signUp": [
                256,
                {
                    "email": [
                        1,
                        "String!"
                    ],
                    "password": [
                        1,
                        "String!"
                    ],
                    "captchaToken": [
                        1
                    ],
                    "locale": [
                        1
                    ],
                    "verifyEmailRedirectPath": [
                        1
                    ]
                }
            ],
            "signUpInWorkspace": [
                261,
                {
                    "email": [
                        1,
                        "String!"
                    ],
                    "password": [
                        1,
                        "String!"
                    ],
                    "workspaceId": [
                        4
                    ],
                    "workspaceInviteHash": [
                        1
                    ],
                    "workspacePersonalInviteToken": [
                        1
                    ],
                    "captchaToken": [
                        1
                    ],
                    "locale": [
                        1
                    ],
                    "verifyEmailRedirectPath": [
                        1
                    ]
                }
            ],
            "signUpInNewWorkspace": [
                261,
                {
                    "input": [
                        499
                    ]
                }
            ],
            "uploadNewWorkspaceLogo": [
                146,
                {
                    "workspaceId": [
                        1,
                        "String!"
                    ],
                    "file": [
                        373,
                        "Upload!"
                    ]
                }
            ],
            "generateTransientToken": [
                262
            ],
            "getAuthTokensFromLoginToken": [
                268,
                {
                    "loginToken": [
                        1,
                        "String!"
                    ],
                    "origin": [
                        1,
                        "String!"
                    ]
                }
            ],
            "authorizeApp": [
                254,
                {
                    "clientId": [
                        1,
                        "String!"
                    ],
                    "codeChallenge": [
                        1
                    ],
                    "redirectUrl": [
                        1,
                        "String!"
                    ],
                    "state": [
                        1
                    ],
                    "scope": [
                        1
                    ]
                }
            ],
            "renewToken": [
                268,
                {
                    "appToken": [
                        1,
                        "String!"
                    ]
                }
            ],
            "generateApiKeyToken": [
                267,
                {
                    "apiKeyId": [
                        4,
                        "UUID!"
                    ],
                    "expiresAt": [
                        1,
                        "String!"
                    ]
                }
            ],
            "generatePlaygroundToken": [
                12
            ],
            "emailPasswordResetLink": [
                257,
                {
                    "email": [
                        1,
                        "String!"
                    ],
                    "workspaceId": [
                        4
                    ]
                }
            ],
            "updatePasswordViaResetToken": [
                259,
                {
                    "passwordResetToken": [
                        1,
                        "String!"
                    ],
                    "newPassword": [
                        1,
                        "String!"
                    ]
                }
            ],
            "initiateOTPProvisioning": [
                252,
                {
                    "loginToken": [
                        1,
                        "String!"
                    ],
                    "origin": [
                        1,
                        "String!"
                    ]
                }
            ],
            "initiateOTPProvisioningForAuthenticatedUser": [
                252
            ],
            "deleteTwoFactorAuthenticationMethod": [
                251,
                {
                    "twoFactorAuthenticationMethodId": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "verifyTwoFactorAuthenticationMethodForAuthenticatedUser": [
                253,
                {
                    "otp": [
                        1,
                        "String!"
                    ]
                }
            ],
            "deleteUser": [
                73
            ],
            "deleteUserFromWorkspace": [
                52,
                {
                    "workspaceMemberIdToDelete": [
                        1,
                        "String!"
                    ]
                }
            ],
            "updateWorkspaceMemberSettings": [
                3,
                {
                    "input": [
                        500,
                        "UpdateWorkspaceMemberSettingsInput!"
                    ]
                }
            ],
            "updateUserEmail": [
                3,
                {
                    "newEmail": [
                        1,
                        "String!"
                    ],
                    "verifyEmailRedirectPath": [
                        1
                    ]
                }
            ],
            "resendEmailVerificationToken": [
                213,
                {
                    "email": [
                        1,
                        "String!"
                    ],
                    "origin": [
                        1,
                        "String!"
                    ]
                }
            ],
            "createOIDCIdentityProvider": [
                218,
                {
                    "input": [
                        501,
                        "SetupOIDCSsoInput!"
                    ]
                }
            ],
            "createSAMLIdentityProvider": [
                218,
                {
                    "input": [
                        502,
                        "SetupSAMLSsoInput!"
                    ]
                }
            ],
            "deleteSSOIdentityProvider": [
                214,
                {
                    "input": [
                        503,
                        "DeleteSsoInput!"
                    ]
                }
            ],
            "editSSOIdentityProvider": [
                215,
                {
                    "input": [
                        504,
                        "EditSsoInput!"
                    ]
                }
            ],
            "createObjectEvent": [
                320,
                {
                    "event": [
                        1,
                        "String!"
                    ],
                    "recordId": [
                        4,
                        "UUID!"
                    ],
                    "objectMetadataId": [
                        4,
                        "UUID!"
                    ],
                    "properties": [
                        5
                    ]
                }
            ],
            "trackAnalytics": [
                320,
                {
                    "type": [
                        505,
                        "AnalyticsType!"
                    ],
                    "name": [
                        1
                    ],
                    "event": [
                        1
                    ],
                    "properties": [
                        5
                    ]
                }
            ],
            "duplicateDashboard": [
                318,
                {
                    "id": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "impersonate": [
                272,
                {
                    "userId": [
                        4,
                        "UUID!"
                    ],
                    "workspaceId": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "createCalendarEvent": [
                309,
                {
                    "input": [
                        506,
                        "CreateCalendarEventInput!"
                    ]
                }
            ],
            "sendEmail": [
                319,
                {
                    "input": [
                        507,
                        "SendEmailInput!"
                    ]
                }
            ],
            "startChannelSync": [
                310,
                {
                    "connectedAccountId": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "saveImapSmtpCaldavAccount": [
                289,
                {
                    "handle": [
                        1,
                        "String!"
                    ],
                    "connectionParameters": [
                        509,
                        "EmailAccountConnectionParameters!"
                    ],
                    "id": [
                        4
                    ]
                }
            ],
            "updateLabPublicFeatureFlag": [
                178,
                {
                    "input": [
                        511,
                        "UpdateLabPublicFeatureFlagInput!"
                    ]
                }
            ],
            "createPublicDomain": [
                279,
                {
                    "domain": [
                        1,
                        "String!"
                    ],
                    "applicationId": [
                        1,
                        "String!"
                    ]
                }
            ],
            "deletePublicDomain": [
                3,
                {
                    "domain": [
                        1,
                        "String!"
                    ]
                }
            ],
            "checkPublicDomainValidRecords": [
                244,
                {
                    "domain": [
                        1,
                        "String!"
                    ]
                }
            ],
            "createDevelopmentApplication": [
                276,
                {
                    "universalIdentifier": [
                        1,
                        "String!"
                    ],
                    "name": [
                        1,
                        "String!"
                    ]
                }
            ],
            "syncApplication": [
                277,
                {
                    "manifest": [
                        5,
                        "JSON!"
                    ],
                    "dryRun": [
                        3
                    ]
                }
            ],
            "uploadApplicationFile": [
                278,
                {
                    "file": [
                        373,
                        "Upload!"
                    ],
                    "applicationUniversalIdentifier": [
                        1,
                        "String!"
                    ],
                    "fileFolder": [
                        372,
                        "FileFolder!"
                    ],
                    "filePath": [
                        1,
                        "String!"
                    ]
                }
            ],
            "generateApplicationToken": [
                13,
                {
                    "applicationId": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "renewApplicationToken": [
                13,
                {
                    "applicationRefreshToken": [
                        1,
                        "String!"
                    ]
                }
            ],
            "__typename": [
                1
            ]
        },
        "AddQuerySubscriptionInput": {
            "eventStreamId": [
                1
            ],
            "queryId": [
                1
            ],
            "operationSignature": [
                5
            ],
            "__typename": [
                1
            ]
        },
        "RemoveQueryFromEventStreamInput": {
            "eventStreamId": [
                1
            ],
            "queryId": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "CreateNavigationMenuItemInput": {
            "id": [
                4
            ],
            "userWorkspaceId": [
                4
            ],
            "targetRecordId": [
                4
            ],
            "targetObjectMetadataId": [
                4
            ],
            "viewId": [
                4
            ],
            "type": [
                170
            ],
            "name": [
                1
            ],
            "link": [
                1
            ],
            "icon": [
                1
            ],
            "color": [
                1
            ],
            "folderId": [
                4
            ],
            "pageLayoutId": [
                4
            ],
            "position": [
                16
            ],
            "__typename": [
                1
            ]
        },
        "UpdateOneNavigationMenuItemInput": {
            "id": [
                4
            ],
            "update": [
                371
            ],
            "__typename": [
                1
            ]
        },
        "UpdateNavigationMenuItemInput": {
            "folderId": [
                4
            ],
            "position": [
                16
            ],
            "name": [
                1
            ],
            "link": [
                1
            ],
            "icon": [
                1
            ],
            "color": [
                1
            ],
            "pageLayoutId": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "FileFolder": {},
        "Upload": {},
        "UpsertAiProviderCredentialInput": {
            "providerName": [
                1
            ],
            "apiKey": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "CreateViewFilterGroupInput": {
            "id": [
                4
            ],
            "parentViewFilterGroupId": [
                4
            ],
            "logicalOperator": [
                57
            ],
            "positionInViewFilterGroup": [
                16
            ],
            "viewId": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "UpdateViewFilterGroupInput": {
            "id": [
                4
            ],
            "parentViewFilterGroupId": [
                4
            ],
            "logicalOperator": [
                57
            ],
            "positionInViewFilterGroup": [
                16
            ],
            "viewId": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "CreateViewFilterInput": {
            "id": [
                4
            ],
            "fieldMetadataId": [
                4
            ],
            "operand": [
                59
            ],
            "value": [
                5
            ],
            "viewFilterGroupId": [
                4
            ],
            "positionInViewFilterGroup": [
                16
            ],
            "subFieldName": [
                1
            ],
            "relationTargetFieldMetadataId": [
                4
            ],
            "viewId": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "UpdateViewFilterInput": {
            "id": [
                4
            ],
            "update": [
                379
            ],
            "__typename": [
                1
            ]
        },
        "UpdateViewFilterInputUpdates": {
            "fieldMetadataId": [
                4
            ],
            "operand": [
                59
            ],
            "value": [
                5
            ],
            "viewFilterGroupId": [
                4
            ],
            "positionInViewFilterGroup": [
                16
            ],
            "subFieldName": [
                1
            ],
            "relationTargetFieldMetadataId": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "DeleteViewFilterInput": {
            "id": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "DestroyViewFilterInput": {
            "id": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "CreateViewInput": {
            "id": [
                4
            ],
            "name": [
                1
            ],
            "objectMetadataId": [
                4
            ],
            "type": [
                65
            ],
            "key": [
                66
            ],
            "icon": [
                1
            ],
            "position": [
                16
            ],
            "isCompact": [
                3
            ],
            "shouldHideEmptyGroups": [
                3
            ],
            "kanbanColumnWidth": [
                30
            ],
            "openRecordIn": [
                67
            ],
            "kanbanAggregateOperation": [
                55
            ],
            "kanbanAggregateOperationFieldMetadataId": [
                4
            ],
            "anyFieldFilterValue": [
                1
            ],
            "calendarLayout": [
                68
            ],
            "calendarFieldMetadataId": [
                4
            ],
            "calendarEndFieldMetadataId": [
                4
            ],
            "mainGroupByFieldMetadataId": [
                4
            ],
            "visibility": [
                69
            ],
            "__typename": [
                1
            ]
        },
        "UpdateViewInput": {
            "id": [
                4
            ],
            "name": [
                1
            ],
            "type": [
                65
            ],
            "icon": [
                1
            ],
            "position": [
                16
            ],
            "isCompact": [
                3
            ],
            "openRecordIn": [
                67
            ],
            "kanbanAggregateOperation": [
                55
            ],
            "kanbanAggregateOperationFieldMetadataId": [
                4
            ],
            "anyFieldFilterValue": [
                1
            ],
            "calendarLayout": [
                68
            ],
            "calendarFieldMetadataId": [
                4
            ],
            "calendarEndFieldMetadataId": [
                4
            ],
            "visibility": [
                69
            ],
            "mainGroupByFieldMetadataId": [
                4
            ],
            "shouldHideEmptyGroups": [
                3
            ],
            "kanbanColumnWidth": [
                30
            ],
            "__typename": [
                1
            ]
        },
        "UpsertViewWidgetInput": {
            "widgetId": [
                4
            ],
            "view": [
                385
            ],
            "viewFields": [
                386
            ],
            "viewFilters": [
                387
            ],
            "viewFilterGroups": [
                388
            ],
            "viewSorts": [
                389
            ],
            "__typename": [
                1
            ]
        },
        "UpsertViewWidgetViewSettingsInput": {
            "type": [
                65
            ],
            "mainGroupByFieldMetadataId": [
                4
            ],
            "shouldHideEmptyGroups": [
                3
            ],
            "openRecordIn": [
                67
            ],
            "kanbanAggregateOperation": [
                55
            ],
            "kanbanAggregateOperationFieldMetadataId": [
                4
            ],
            "kanbanColumnWidth": [
                30
            ],
            "calendarLayout": [
                68
            ],
            "calendarFieldMetadataId": [
                4
            ],
            "calendarEndFieldMetadataId": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "UpsertViewWidgetViewFieldInput": {
            "viewFieldId": [
                4
            ],
            "fieldMetadataId": [
                4
            ],
            "isVisible": [
                3
            ],
            "position": [
                16
            ],
            "size": [
                16
            ],
            "aggregateOperation": [
                55
            ],
            "__typename": [
                1
            ]
        },
        "UpsertViewWidgetViewFilterInput": {
            "id": [
                4
            ],
            "fieldMetadataId": [
                4
            ],
            "operand": [
                59
            ],
            "value": [
                5
            ],
            "viewFilterGroupId": [
                4
            ],
            "positionInViewFilterGroup": [
                16
            ],
            "subFieldName": [
                1
            ],
            "relationTargetFieldMetadataId": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "UpsertViewWidgetViewFilterGroupInput": {
            "id": [
                4
            ],
            "parentViewFilterGroupId": [
                4
            ],
            "logicalOperator": [
                57
            ],
            "positionInViewFilterGroup": [
                16
            ],
            "__typename": [
                1
            ]
        },
        "UpsertViewWidgetViewSortInput": {
            "id": [
                4
            ],
            "fieldMetadataId": [
                4
            ],
            "direction": [
                62
            ],
            "__typename": [
                1
            ]
        },
        "CreateViewSortInput": {
            "id": [
                4
            ],
            "fieldMetadataId": [
                4
            ],
            "direction": [
                62
            ],
            "subFieldName": [
                1
            ],
            "viewId": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "UpdateViewSortInput": {
            "id": [
                4
            ],
            "update": [
                392
            ],
            "__typename": [
                1
            ]
        },
        "UpdateViewSortInputUpdates": {
            "direction": [
                62
            ],
            "subFieldName": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "DeleteViewSortInput": {
            "id": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "DestroyViewSortInput": {
            "id": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "UpdateViewFieldInput": {
            "id": [
                4
            ],
            "update": [
                396
            ],
            "__typename": [
                1
            ]
        },
        "UpdateViewFieldInputUpdates": {
            "isVisible": [
                3
            ],
            "size": [
                16
            ],
            "position": [
                16
            ],
            "aggregateOperation": [
                55
            ],
            "viewFieldGroupId": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "CreateViewFieldInput": {
            "id": [
                4
            ],
            "fieldMetadataId": [
                4
            ],
            "viewId": [
                4
            ],
            "isVisible": [
                3
            ],
            "size": [
                16
            ],
            "position": [
                16
            ],
            "aggregateOperation": [
                55
            ],
            "viewFieldGroupId": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "DeleteViewFieldInput": {
            "id": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "DestroyViewFieldInput": {
            "id": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "UpdateViewFieldGroupInput": {
            "id": [
                4
            ],
            "update": [
                401
            ],
            "__typename": [
                1
            ]
        },
        "UpdateViewFieldGroupInputUpdates": {
            "name": [
                1
            ],
            "position": [
                16
            ],
            "isVisible": [
                3
            ],
            "deletedAt": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "CreateViewFieldGroupInput": {
            "id": [
                4
            ],
            "name": [
                1
            ],
            "viewId": [
                4
            ],
            "position": [
                16
            ],
            "isVisible": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "DeleteViewFieldGroupInput": {
            "id": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "DestroyViewFieldGroupInput": {
            "id": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "UpsertFieldsWidgetInput": {
            "widgetId": [
                4
            ],
            "groups": [
                406
            ],
            "fields": [
                407
            ],
            "__typename": [
                1
            ]
        },
        "UpsertFieldsWidgetGroupInput": {
            "id": [
                4
            ],
            "name": [
                1
            ],
            "position": [
                16
            ],
            "isVisible": [
                3
            ],
            "fields": [
                407
            ],
            "__typename": [
                1
            ]
        },
        "UpsertFieldsWidgetFieldInput": {
            "viewFieldId": [
                4
            ],
            "fieldMetadataId": [
                4
            ],
            "isVisible": [
                3
            ],
            "position": [
                16
            ],
            "__typename": [
                1
            ]
        },
        "CreateApiKeyInput": {
            "name": [
                1
            ],
            "expiresAt": [
                1
            ],
            "revokedAt": [
                1
            ],
            "roleId": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "UpdateApiKeyInput": {
            "id": [
                4
            ],
            "name": [
                1
            ],
            "expiresAt": [
                1
            ],
            "revokedAt": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "RevokeApiKeyInput": {
            "id": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "CreateRazorpayOrderInput": {
            "creditPackKey": [
                1
            ],
            "currency": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "RequestInvoiceForCreditsInput": {
            "creditPackKey": [
                1
            ],
            "companyName": [
                1
            ],
            "billingAddress": [
                1
            ],
            "billingEmail": [
                1
            ],
            "vatNumber": [
                1
            ],
            "currency": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "CreateApprovedAccessDomainInput": {
            "domain": [
                1
            ],
            "email": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "DeleteApprovedAccessDomainInput": {
            "id": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "ValidateApprovedAccessDomainInput": {
            "validationToken": [
                1
            ],
            "approvedAccessDomainId": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "CreatePageLayoutTabInput": {
            "title": [
                1
            ],
            "position": [
                16
            ],
            "pageLayoutId": [
                4
            ],
            "layoutMode": [
                85
            ],
            "__typename": [
                1
            ]
        },
        "UpdatePageLayoutTabInput": {
            "title": [
                1
            ],
            "position": [
                16
            ],
            "icon": [
                1
            ],
            "layoutMode": [
                85
            ],
            "__typename": [
                1
            ]
        },
        "CreatePageLayoutInput": {
            "name": [
                1
            ],
            "type": [
                121
            ],
            "objectMetadataId": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "UpdatePageLayoutInput": {
            "name": [
                1
            ],
            "type": [
                121
            ],
            "objectMetadataId": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "UpdatePageLayoutWithTabsInput": {
            "name": [
                1
            ],
            "type": [
                121
            ],
            "objectMetadataId": [
                4
            ],
            "tabs": [
                421
            ],
            "__typename": [
                1
            ]
        },
        "UpdatePageLayoutTabWithWidgetsInput": {
            "id": [
                4
            ],
            "title": [
                1
            ],
            "position": [
                16
            ],
            "icon": [
                1
            ],
            "layoutMode": [
                85
            ],
            "widgets": [
                422
            ],
            "__typename": [
                1
            ]
        },
        "UpdatePageLayoutWidgetWithIdInput": {
            "id": [
                4
            ],
            "pageLayoutTabId": [
                4
            ],
            "title": [
                1
            ],
            "type": [
                82
            ],
            "objectMetadataId": [
                4
            ],
            "gridPosition": [
                423
            ],
            "position": [
                5
            ],
            "configuration": [
                5
            ],
            "conditionalDisplay": [
                5
            ],
            "conditionalAvailabilityExpression": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "GridPositionInput": {
            "row": [
                16
            ],
            "column": [
                16
            ],
            "rowSpan": [
                16
            ],
            "columnSpan": [
                16
            ],
            "__typename": [
                1
            ]
        },
        "CreatePageLayoutWidgetInput": {
            "pageLayoutTabId": [
                4
            ],
            "title": [
                1
            ],
            "type": [
                82
            ],
            "objectMetadataId": [
                4
            ],
            "gridPosition": [
                423
            ],
            "position": [
                5
            ],
            "configuration": [
                5
            ],
            "__typename": [
                1
            ]
        },
        "UpdatePageLayoutWidgetInput": {
            "pageLayoutTabId": [
                4
            ],
            "title": [
                1
            ],
            "type": [
                82
            ],
            "objectMetadataId": [
                4
            ],
            "gridPosition": [
                423
            ],
            "position": [
                5
            ],
            "configuration": [
                5
            ],
            "conditionalDisplay": [
                5
            ],
            "conditionalAvailabilityExpression": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "CreateAgentInput": {
            "name": [
                1
            ],
            "label": [
                1
            ],
            "icon": [
                1
            ],
            "description": [
                1
            ],
            "prompt": [
                1
            ],
            "modelId": [
                1
            ],
            "roleId": [
                4
            ],
            "responseFormat": [
                5
            ],
            "modelConfiguration": [
                5
            ],
            "evaluationInputs": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "UpdateAgentInput": {
            "id": [
                4
            ],
            "name": [
                1
            ],
            "label": [
                1
            ],
            "icon": [
                1
            ],
            "description": [
                1
            ],
            "prompt": [
                1
            ],
            "modelId": [
                1
            ],
            "roleId": [
                4
            ],
            "responseFormat": [
                5
            ],
            "modelConfiguration": [
                5
            ],
            "evaluationInputs": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "CreateOneObjectInput": {
            "object": [
                429
            ],
            "__typename": [
                1
            ]
        },
        "CreateObjectInput": {
            "nameSingular": [
                1
            ],
            "namePlural": [
                1
            ],
            "labelSingular": [
                1
            ],
            "labelPlural": [
                1
            ],
            "description": [
                1
            ],
            "icon": [
                1
            ],
            "shortcut": [
                1
            ],
            "color": [
                1
            ],
            "skipNameField": [
                3
            ],
            "isRemote": [
                3
            ],
            "primaryKeyColumnType": [
                1
            ],
            "primaryKeyFieldMetadataSettings": [
                5
            ],
            "isLabelSyncedWithName": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "DeleteOneObjectInput": {
            "id": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "UpdateOneObjectInput": {
            "update": [
                432
            ],
            "id": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "UpdateObjectPayload": {
            "labelSingular": [
                1
            ],
            "labelPlural": [
                1
            ],
            "nameSingular": [
                1
            ],
            "namePlural": [
                1
            ],
            "description": [
                1
            ],
            "icon": [
                1
            ],
            "shortcut": [
                1
            ],
            "color": [
                1
            ],
            "isActive": [
                3
            ],
            "labelIdentifierFieldMetadataId": [
                4
            ],
            "imageIdentifierFieldMetadataId": [
                4
            ],
            "isLabelSyncedWithName": [
                3
            ],
            "isSearchable": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "CreateOneIndexInput": {
            "index": [
                434
            ],
            "__typename": [
                1
            ]
        },
        "CreateIndexInput": {
            "objectMetadataId": [
                4
            ],
            "fields": [
                435
            ],
            "indexType": [
                27
            ],
            "__typename": [
                1
            ]
        },
        "CreateIndexFieldInput": {
            "fieldMetadataId": [
                4
            ],
            "subFieldName": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "DeleteOneIndexInput": {
            "id": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "CreateLogicFunctionFromSourceInput": {
            "id": [
                4
            ],
            "universalIdentifier": [
                4
            ],
            "name": [
                1
            ],
            "description": [
                1
            ],
            "timeoutSeconds": [
                16
            ],
            "source": [
                5
            ],
            "cronTriggerSettings": [
                5
            ],
            "databaseEventTriggerSettings": [
                5
            ],
            "httpRouteTriggerSettings": [
                5
            ],
            "serverRouteTriggerSettings": [
                5
            ],
            "toolTriggerSettings": [
                5
            ],
            "workflowActionTriggerSettings": [
                5
            ],
            "__typename": [
                1
            ]
        },
        "ExecuteOneLogicFunctionInput": {
            "id": [
                4
            ],
            "payload": [
                5
            ],
            "__typename": [
                1
            ]
        },
        "UpdateLogicFunctionFromSourceInput": {
            "id": [
                4
            ],
            "update": [
                440
            ],
            "__typename": [
                1
            ]
        },
        "UpdateLogicFunctionFromSourceInputUpdates": {
            "name": [
                1
            ],
            "description": [
                1
            ],
            "timeoutSeconds": [
                16
            ],
            "sourceHandlerCode": [
                1
            ],
            "handlerName": [
                1
            ],
            "sourceHandlerPath": [
                1
            ],
            "cronTriggerSettings": [
                5
            ],
            "databaseEventTriggerSettings": [
                5
            ],
            "httpRouteTriggerSettings": [
                5
            ],
            "toolTriggerSettings": [
                5
            ],
            "workflowActionTriggerSettings": [
                5
            ],
            "__typename": [
                1
            ]
        },
        "CreateCommandMenuItemInput": {
            "workflowVersionId": [
                4
            ],
            "frontComponentId": [
                4
            ],
            "engineComponentKey": [
                17
            ],
            "label": [
                1
            ],
            "icon": [
                1
            ],
            "shortLabel": [
                1
            ],
            "position": [
                16
            ],
            "isPinned": [
                3
            ],
            "availabilityType": [
                18
            ],
            "hotKeys": [
                1
            ],
            "conditionalAvailabilityExpression": [
                1
            ],
            "availabilityObjectMetadataId": [
                4
            ],
            "payload": [
                5
            ],
            "pageLayoutId": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "UpdateCommandMenuItemInput": {
            "id": [
                4
            ],
            "label": [
                1
            ],
            "icon": [
                1
            ],
            "shortLabel": [
                1
            ],
            "position": [
                16
            ],
            "isPinned": [
                3
            ],
            "availabilityType": [
                18
            ],
            "availabilityObjectMetadataId": [
                4
            ],
            "engineComponentKey": [
                17
            ],
            "hotKeys": [
                1
            ],
            "pageLayoutId": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "CreateFrontComponentInput": {
            "id": [
                4
            ],
            "name": [
                1
            ],
            "description": [
                1
            ],
            "sourceComponentPath": [
                1
            ],
            "builtComponentPath": [
                1
            ],
            "componentName": [
                1
            ],
            "builtComponentChecksum": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "UpdateFrontComponentInput": {
            "id": [
                4
            ],
            "update": [
                445
            ],
            "__typename": [
                1
            ]
        },
        "UpdateFrontComponentInputUpdates": {
            "name": [
                1
            ],
            "description": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "ActivateWorkspaceInput": {
            "displayName": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "UpdateWorkspaceInput": {
            "subdomain": [
                1
            ],
            "customDomain": [
                1
            ],
            "displayName": [
                1
            ],
            "logo": [
                1
            ],
            "inviteHash": [
                1
            ],
            "isPublicInviteLinkEnabled": [
                3
            ],
            "workspaceDiscoverability": [
                71
            ],
            "allowImpersonation": [
                3
            ],
            "isGoogleAuthEnabled": [
                3
            ],
            "isMicrosoftAuthEnabled": [
                3
            ],
            "isPasswordAuthEnabled": [
                3
            ],
            "isGoogleAuthBypassEnabled": [
                3
            ],
            "isMicrosoftAuthBypassEnabled": [
                3
            ],
            "isPasswordAuthBypassEnabled": [
                3
            ],
            "defaultRoleId": [
                4
            ],
            "isTwoFactorAuthenticationEnforced": [
                3
            ],
            "trashRetentionDays": [
                16
            ],
            "eventLogRetentionDays": [
                16
            ],
            "fastModel": [
                1
            ],
            "smartModel": [
                1
            ],
            "aiAdditionalInstructions": [
                1
            ],
            "editableProfileFields": [
                1
            ],
            "enabledAiModelIds": [
                1
            ],
            "useRecommendedModels": [
                3
            ],
            "isInternalMessagesImportEnabled": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "CreateApplicationRegistrationInput": {
            "name": [
                1
            ],
            "universalIdentifier": [
                1
            ],
            "oAuthRedirectUris": [
                1
            ],
            "oAuthScopes": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "UpdateApplicationRegistrationInput": {
            "id": [
                1
            ],
            "update": [
                450
            ],
            "__typename": [
                1
            ]
        },
        "UpdateApplicationRegistrationPayload": {
            "name": [
                1
            ],
            "oAuthRedirectUris": [
                1
            ],
            "oAuthScopes": [
                1
            ],
            "isListed": [
                3
            ],
            "isPreInstalled": [
                3
            ],
            "isVetted": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "CreateApplicationRegistrationVariableInput": {
            "applicationRegistrationId": [
                1
            ],
            "key": [
                1
            ],
            "value": [
                1
            ],
            "description": [
                1
            ],
            "isSecret": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "UpdateApplicationRegistrationVariableInput": {
            "id": [
                1
            ],
            "update": [
                453
            ],
            "__typename": [
                1
            ]
        },
        "UpdateApplicationRegistrationVariablePayload": {
            "value": [
                1
            ],
            "resetValue": [
                3
            ],
            "description": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "UpdateApplicationInput": {
            "autoUpgrade": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "CreateOneFieldMetadataInput": {
            "field": [
                456
            ],
            "__typename": [
                1
            ]
        },
        "CreateFieldInput": {
            "type": [
                25
            ],
            "name": [
                1
            ],
            "label": [
                1
            ],
            "description": [
                1
            ],
            "icon": [
                1
            ],
            "isActive": [
                3
            ],
            "isSystem": [
                3
            ],
            "isUIEditable": [
                3
            ],
            "isUIReadOnly": [
                3
            ],
            "isNullable": [
                3
            ],
            "isUnique": [
                3
            ],
            "defaultValue": [
                5
            ],
            "options": [
                5
            ],
            "settings": [
                5
            ],
            "objectMetadataId": [
                4
            ],
            "isLabelSyncedWithName": [
                3
            ],
            "isRemoteCreation": [
                3
            ],
            "relationCreationPayload": [
                5
            ],
            "morphRelationsCreationPayload": [
                5
            ],
            "__typename": [
                1
            ]
        },
        "UpdateOneFieldMetadataInput": {
            "id": [
                4
            ],
            "update": [
                458
            ],
            "__typename": [
                1
            ]
        },
        "UpdateFieldInput": {
            "universalIdentifier": [
                1
            ],
            "name": [
                1
            ],
            "label": [
                1
            ],
            "description": [
                1
            ],
            "icon": [
                1
            ],
            "isActive": [
                3
            ],
            "isSystem": [
                3
            ],
            "isUIEditable": [
                3
            ],
            "isUIReadOnly": [
                3
            ],
            "isNullable": [
                3
            ],
            "isUnique": [
                3
            ],
            "defaultValue": [
                5
            ],
            "options": [
                5
            ],
            "settings": [
                5
            ],
            "objectMetadataId": [
                4
            ],
            "isLabelSyncedWithName": [
                3
            ],
            "morphRelationsUpdatePayload": [
                5
            ],
            "__typename": [
                1
            ]
        },
        "DeleteOneFieldInput": {
            "id": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "CreateViewGroupInput": {
            "id": [
                4
            ],
            "isVisible": [
                3
            ],
            "fieldValue": [
                1
            ],
            "position": [
                16
            ],
            "viewId": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "UpdateViewGroupInput": {
            "id": [
                4
            ],
            "update": [
                462
            ],
            "__typename": [
                1
            ]
        },
        "UpdateViewGroupInputUpdates": {
            "fieldMetadataId": [
                4
            ],
            "isVisible": [
                3
            ],
            "fieldValue": [
                1
            ],
            "position": [
                16
            ],
            "__typename": [
                1
            ]
        },
        "DeleteViewGroupInput": {
            "id": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "DestroyViewGroupInput": {
            "id": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "CreateRoleInput": {
            "id": [
                1
            ],
            "label": [
                1
            ],
            "description": [
                1
            ],
            "icon": [
                1
            ],
            "canUpdateAllSettings": [
                3
            ],
            "canAccessAllTools": [
                3
            ],
            "canReadAllObjectRecords": [
                3
            ],
            "canUpdateAllObjectRecords": [
                3
            ],
            "canSoftDeleteAllObjectRecords": [
                3
            ],
            "canDestroyAllObjectRecords": [
                3
            ],
            "canBeAssignedToUsers": [
                3
            ],
            "canBeAssignedToAgents": [
                3
            ],
            "canBeAssignedToApiKeys": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "UpdateRoleInput": {
            "update": [
                467
            ],
            "id": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "UpdateRolePayload": {
            "label": [
                1
            ],
            "description": [
                1
            ],
            "icon": [
                1
            ],
            "canUpdateAllSettings": [
                3
            ],
            "canAccessAllTools": [
                3
            ],
            "canReadAllObjectRecords": [
                3
            ],
            "canUpdateAllObjectRecords": [
                3
            ],
            "canSoftDeleteAllObjectRecords": [
                3
            ],
            "canDestroyAllObjectRecords": [
                3
            ],
            "canBeAssignedToUsers": [
                3
            ],
            "canBeAssignedToAgents": [
                3
            ],
            "canBeAssignedToApiKeys": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "UpsertObjectPermissionsInput": {
            "roleId": [
                4
            ],
            "objectPermissions": [
                469
            ],
            "__typename": [
                1
            ]
        },
        "ObjectPermissionInput": {
            "objectMetadataId": [
                4
            ],
            "canReadObjectRecords": [
                3
            ],
            "canUpdateObjectRecords": [
                3
            ],
            "canSoftDeleteObjectRecords": [
                3
            ],
            "canDestroyObjectRecords": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "UpsertPermissionFlagsInput": {
            "roleId": [
                4
            ],
            "permissionFlagKeys": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "UpsertFieldPermissionsInput": {
            "roleId": [
                4
            ],
            "fieldPermissions": [
                472
            ],
            "__typename": [
                1
            ]
        },
        "FieldPermissionInput": {
            "objectMetadataId": [
                4
            ],
            "fieldMetadataId": [
                4
            ],
            "canReadFieldValue": [
                3
            ],
            "canUpdateFieldValue": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "UpsertRowLevelPermissionPredicatesInput": {
            "roleId": [
                4
            ],
            "objectMetadataId": [
                4
            ],
            "predicates": [
                474
            ],
            "predicateGroups": [
                475
            ],
            "__typename": [
                1
            ]
        },
        "RowLevelPermissionPredicateInput": {
            "id": [
                4
            ],
            "fieldMetadataId": [
                4
            ],
            "operand": [
                45
            ],
            "value": [
                5
            ],
            "subFieldName": [
                1
            ],
            "workspaceMemberFieldMetadataId": [
                1
            ],
            "workspaceMemberSubFieldName": [
                1
            ],
            "rowLevelPermissionPredicateGroupId": [
                4
            ],
            "positionInRowLevelPermissionPredicateGroup": [
                16
            ],
            "__typename": [
                1
            ]
        },
        "RowLevelPermissionPredicateGroupInput": {
            "id": [
                4
            ],
            "objectMetadataId": [
                4
            ],
            "parentRowLevelPermissionPredicateGroupId": [
                4
            ],
            "logicalOperator": [
                43
            ],
            "positionInRowLevelPermissionPredicateGroup": [
                16
            ],
            "__typename": [
                1
            ]
        },
        "SendEmailViaDomainInput": {
            "emailingDomainId": [
                1
            ],
            "to": [
                1
            ],
            "cc": [
                1
            ],
            "bcc": [
                1
            ],
            "subject": [
                1
            ],
            "text": [
                1
            ],
            "html": [
                1
            ],
            "from": [
                1
            ],
            "replyTo": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "SendMessageCampaignInput": {
            "listId": [
                1
            ],
            "unsubscribeTopicId": [
                1
            ],
            "subject": [
                1
            ],
            "body": [
                1
            ],
            "fromAddress": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "CreateUnsubscribeTopicInput": {
            "name": [
                1
            ],
            "description": [
                1
            ],
            "visibility": [
                304
            ],
            "__typename": [
                1
            ]
        },
        "UpdateUnsubscribeTopicInput": {
            "id": [
                1
            ],
            "name": [
                1
            ],
            "description": [
                1
            ],
            "visibility": [
                304
            ],
            "__typename": [
                1
            ]
        },
        "UpdateMessageChannelInput": {
            "id": [
                4
            ],
            "update": [
                481
            ],
            "__typename": [
                1
            ]
        },
        "UpdateMessageChannelInputUpdates": {
            "visibility": [
                291
            ],
            "isContactAutoCreationEnabled": [
                3
            ],
            "contactAutoCreationPolicy": [
                293
            ],
            "messageFolderImportPolicy": [
                294
            ],
            "isSyncEnabled": [
                3
            ],
            "excludeNonProfessionalEmails": [
                3
            ],
            "excludeGroupEmails": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "CreateEmailGroupChannelInput": {
            "handle": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "CreateEmailingDomainInput": {
            "domain": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "RunAgentInput": {
            "agentUniversalIdentifier": [
                1
            ],
            "prompt": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "CreateWebhookInput": {
            "id": [
                4
            ],
            "targetUrl": [
                1
            ],
            "operations": [
                1
            ],
            "description": [
                1
            ],
            "secret": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "UpdateWebhookInput": {
            "id": [
                4
            ],
            "update": [
                487
            ],
            "__typename": [
                1
            ]
        },
        "UpdateWebhookInputUpdates": {
            "targetUrl": [
                1
            ],
            "operations": [
                1
            ],
            "description": [
                1
            ],
            "secret": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "UpdateMessageFolderInput": {
            "id": [
                4
            ],
            "update": [
                489
            ],
            "__typename": [
                1
            ]
        },
        "UpdateMessageFolderInputUpdates": {
            "isSynced": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "UpdateMessageFoldersInput": {
            "ids": [
                4
            ],
            "update": [
                489
            ],
            "__typename": [
                1
            ]
        },
        "UpdateCalendarChannelInput": {
            "id": [
                4
            ],
            "update": [
                492
            ],
            "__typename": [
                1
            ]
        },
        "UpdateCalendarChannelInputUpdates": {
            "visibility": [
                341
            ],
            "isContactAutoCreationEnabled": [
                3
            ],
            "contactAutoCreationPolicy": [
                342
            ],
            "isSyncEnabled": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "SetAppKeyValueInput": {
            "key": [
                1
            ],
            "value": [
                5
            ],
            "scope": [
                337
            ],
            "__typename": [
                1
            ]
        },
        "FileAttachmentInput": {
            "id": [
                4
            ],
            "filename": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "AgentChatQuestionAnswerInput": {
            "questionIndex": [
                30
            ],
            "selectedOptionIndices": [
                30
            ],
            "freeText": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "CreateSkillInput": {
            "id": [
                4
            ],
            "name": [
                1
            ],
            "label": [
                1
            ],
            "icon": [
                1
            ],
            "description": [
                1
            ],
            "content": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "UpdateSkillInput": {
            "id": [
                4
            ],
            "name": [
                1
            ],
            "label": [
                1
            ],
            "icon": [
                1
            ],
            "description": [
                1
            ],
            "content": [
                1
            ],
            "isActive": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "GetAuthorizationUrlForSSOInput": {
            "identityProviderId": [
                4
            ],
            "workspaceInviteHash": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "SignUpInNewWorkspaceInput": {
            "displayName": [
                1
            ],
            "subdomain": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "UpdateWorkspaceMemberSettingsInput": {
            "workspaceMemberId": [
                4
            ],
            "update": [
                5
            ],
            "__typename": [
                1
            ]
        },
        "SetupOIDCSsoInput": {
            "name": [
                1
            ],
            "issuer": [
                1
            ],
            "clientID": [
                1
            ],
            "clientSecret": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "SetupSAMLSsoInput": {
            "name": [
                1
            ],
            "issuer": [
                1
            ],
            "id": [
                4
            ],
            "ssoURL": [
                1
            ],
            "certificate": [
                1
            ],
            "fingerprint": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "DeleteSsoInput": {
            "identityProviderId": [
                4
            ],
            "__typename": [
                1
            ]
        },
        "EditSsoInput": {
            "id": [
                4
            ],
            "status": [
                187
            ],
            "__typename": [
                1
            ]
        },
        "AnalyticsType": {},
        "CreateCalendarEventInput": {
            "connectedAccountId": [
                1
            ],
            "title": [
                1
            ],
            "description": [
                1
            ],
            "location": [
                1
            ],
            "startsAt": [
                1
            ],
            "endsAt": [
                1
            ],
            "isFullDay": [
                3
            ],
            "timeZone": [
                1
            ],
            "attendees": [
                1
            ],
            "sendInvitations": [
                3
            ],
            "addConferencing": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "SendEmailInput": {
            "connectedAccountId": [
                1
            ],
            "to": [
                1
            ],
            "cc": [
                1
            ],
            "bcc": [
                1
            ],
            "subject": [
                1
            ],
            "body": [
                1
            ],
            "inReplyTo": [
                1
            ],
            "draftMessageId": [
                1
            ],
            "files": [
                508
            ],
            "__typename": [
                1
            ]
        },
        "SendEmailAttachmentInput": {
            "id": [
                1
            ],
            "name": [
                1
            ],
            "__typename": [
                1
            ]
        },
        "EmailAccountConnectionParameters": {
            "name": [
                1
            ],
            "IMAP": [
                510
            ],
            "SMTP": [
                510
            ],
            "CALDAV": [
                510
            ],
            "__typename": [
                1
            ]
        },
        "ConnectionParametersInput": {
            "host": [
                1
            ],
            "port": [
                16
            ],
            "username": [
                1
            ],
            "password": [
                1
            ],
            "connectionSecurity": [
                248
            ],
            "__typename": [
                1
            ]
        },
        "UpdateLabPublicFeatureFlagInput": {
            "publicFeatureFlag": [
                1
            ],
            "value": [
                3
            ],
            "__typename": [
                1
            ]
        },
        "Subscription": {
            "onEventSubscription": [
                177,
                {
                    "eventStreamId": [
                        1,
                        "String!"
                    ]
                }
            ],
            "logicFunctionLogs": [
                246,
                {
                    "input": [
                        513,
                        "LogicFunctionLogsInput!"
                    ]
                }
            ],
            "onAgentChatEvent": [
                332,
                {
                    "threadId": [
                        4,
                        "UUID!"
                    ]
                }
            ],
            "eventLogsLive": [
                321,
                {
                    "table": [
                        358,
                        "EventLogTable!"
                    ]
                }
            ],
            "__typename": [
                1
            ]
        },
        "LogicFunctionLogsInput": {
            "applicationId": [
                4
            ],
            "applicationUniversalIdentifier": [
                4
            ],
            "name": [
                1
            ],
            "id": [
                4
            ],
            "universalIdentifier": [
                4
            ],
            "__typename": [
                1
            ]
        }
    }
}
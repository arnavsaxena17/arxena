"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const WorkspaceActivationStatus_1 = require("../../types/WorkspaceActivationStatus");
const isWorkspaceActiveOrSuspended_1 = require("../isWorkspaceActiveOrSuspended");
describe('isWorkspaceActiveOrSuspended', () => {
    it('should return true for Active workspace', () => {
        const workspace = {
            activationStatus: WorkspaceActivationStatus_1.WorkspaceActivationStatus.ACTIVE,
        };
        expect((0, isWorkspaceActiveOrSuspended_1.isWorkspaceActiveOrSuspended)(workspace)).toBe(true);
    });
    it('should return true for Suspended workspace', () => {
        const workspace = {
            activationStatus: WorkspaceActivationStatus_1.WorkspaceActivationStatus.SUSPENDED,
        };
        expect((0, isWorkspaceActiveOrSuspended_1.isWorkspaceActiveOrSuspended)(workspace)).toBe(true);
    });
    it('should return false for Inactive workspace', () => {
        const workspace = {
            activationStatus: WorkspaceActivationStatus_1.WorkspaceActivationStatus.INACTIVE,
        };
        expect((0, isWorkspaceActiveOrSuspended_1.isWorkspaceActiveOrSuspended)(workspace)).toBe(false);
    });
    it('should return false for OngoingCreation workspace', () => {
        const workspace = {
            activationStatus: WorkspaceActivationStatus_1.WorkspaceActivationStatus.ONGOING_CREATION,
        };
        expect((0, isWorkspaceActiveOrSuspended_1.isWorkspaceActiveOrSuspended)(workspace)).toBe(false);
    });
    it('should return false for PendingCreation workspace', () => {
        const workspace = {
            activationStatus: WorkspaceActivationStatus_1.WorkspaceActivationStatus.PENDING_CREATION,
        };
        expect((0, isWorkspaceActiveOrSuspended_1.isWorkspaceActiveOrSuspended)(workspace)).toBe(false);
    });
    it('should return false for undefined workspace', () => {
        expect((0, isWorkspaceActiveOrSuspended_1.isWorkspaceActiveOrSuspended)(undefined)).toBe(false);
    });
    it('should return false for null workspace', () => {
        expect((0, isWorkspaceActiveOrSuspended_1.isWorkspaceActiveOrSuspended)(null)).toBe(false);
    });
});
//# sourceMappingURL=isWorkspaceActiveOrSuspended.test.js.map
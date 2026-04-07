import { expect, Locator, Page } from '@playwright/test';

export class LoginPage {
  private readonly loginWithGoogleButton: Locator;
  private readonly loginWithEmailButton: Locator;
  private readonly termsOfServiceLink: Locator;
  private readonly privacyPolicyLink: Locator;
  private readonly emailField: Locator;
  private readonly continueButton: Locator;
  private readonly forgotPasswordButton: Locator;
  private readonly passwordField: Locator;
  private readonly revealPasswordButton: Locator;
  readonly signInButton: Locator;
  private readonly signUpButton: Locator;
  private readonly previewImageButton: Locator;
  private readonly uploadImageButton: Locator;
  private readonly deleteImageButton: Locator;
  private readonly workspaceNameField: Locator;
  private readonly firstNameField: Locator;
  private readonly lastNameField: Locator;
  private readonly syncEverythingWithGoogleRadio: Locator;
  private readonly syncSubjectAndMetadataWithGoogleRadio: Locator;
  private readonly syncMetadataWithGoogleRadio: Locator;
  private readonly syncWithGoogleButton: Locator;
  private readonly noSyncButton: Locator;
  private readonly inviteLinkField1: Locator;
  private readonly inviteLinkField2: Locator;
  private readonly inviteLinkField3: Locator;
  private readonly copyInviteLink: Locator;
  private readonly finishButton: Locator;

  constructor(public readonly page: Page) {
    this.page = page;
    this.loginWithGoogleButton = page.getByRole('button', {
      name: 'Continue with Google',
    });
    this.loginWithEmailButton = page.getByRole('button', {
      name: 'Continue with Email',
    });
    this.termsOfServiceLink = page.getByRole('link', {
      name: 'Terms of Service',
    });
    this.privacyPolicyLink = page.getByRole('link', { name: 'Privacy Policy' });
    this.emailField = page.getByPlaceholder('Email');
    this.continueButton = page.getByRole('button', {
      name: 'Continue',
      exact: true,
    });
    this.forgotPasswordButton = page.getByText('Forgot your password?');
    this.passwordField = page.getByPlaceholder('Password');
    this.revealPasswordButton = page.getByTestId('reveal-password-button');
    this.signInButton = page.getByRole('button', { name: 'Sign in' });
    this.signUpButton = page.getByRole('button', { name: 'Sign up' });
    this.previewImageButton = page.locator('.css-1qzw107'); // TODO: fix
    this.uploadImageButton = page.getByRole('button', { name: 'Upload' });
    this.deleteImageButton = page.getByRole('button', { name: 'Remove' });
    this.workspaceNameField = page.getByPlaceholder('Apple');
    this.firstNameField = page.getByPlaceholder('Tim');
    this.lastNameField = page.getByPlaceholder('Cook');
    this.syncEverythingWithGoogleRadio = page.locator(
      'input[value="SHARE_EVERYTHING"]',
    );
    this.syncSubjectAndMetadataWithGoogleRadio = page.locator(
      'input[value="SUBJECT"]',
    );
    this.syncMetadataWithGoogleRadio = page.locator('input[value="METADATA"]');
    this.syncWithGoogleButton = page.getByRole('button', {
      name: 'Sync with Google',
    });
    this.noSyncButton = page.getByText('Continue without sync');
    this.inviteLinkField1 = page.getByPlaceholder('tim@apple.dev');
    this.inviteLinkField2 = page.getByPlaceholder('craig@apple.dev');
    this.inviteLinkField3 = page.getByPlaceholder('mike@apple.dev');
    this.copyInviteLink = page.getByRole('button', {
      name: 'Copy invitation link',
    });
    this.finishButton = page.getByRole('button', { name: 'Finish' });
  }

  private async getFirstVisible(locator: Locator) {
    const count = await locator.count();

    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);

      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }

    return null;
  }

  async loginWithGoogle() {
    await this.loginWithGoogleButton.click();
  }

  async clickLoginWithEmail() {
    const visibleButton = await this.getFirstVisible(this.loginWithEmailButton);

    if (!visibleButton) {
      throw new Error('Could not find a visible Continue with Email button');
    }

    await visibleButton.click();
  }

  async hasVisibleLoginWithEmailButton() {
    return (await this.getFirstVisible(this.loginWithEmailButton)) !== null;
  }

  async clickContinueButton() {
    const continueButton = await this.getFirstVisible(this.continueButton);
    const isVisible = continueButton !== null;

    if (isVisible) {
      try {
        await continueButton.click({ timeout: 5_000 });
      } catch {
        try {
          await continueButton.click({ force: true, timeout: 5_000 });
        } catch {
          await this.emailField.first().press('Enter');
        }
      }

      return;
    }

    await this.emailField.first().press('Enter');
  }

  async clickTermsLink() {
    await this.termsOfServiceLink.click();
  }

  async clickPrivacyPolicyLink() {
    await this.privacyPolicyLink.click();
  }

  async typeEmail(email: string) {
    await expect(this.emailField).toBeVisible();

    await this.emailField.fill(email);
  }

  async typePassword(email: string) {
    await this.passwordField.fill(email);
  }

  async expectPasswordStepVisible() {
    await expect(this.passwordField).toBeVisible();
  }

  async expectPasswordStepHidden() {
    await expect(this.passwordField).toBeHidden();
  }

  async clickSignInButton() {
    const visibleButton = await this.getFirstVisible(this.signInButton);

    if (!visibleButton) {
      throw new Error('Could not find a visible Sign in button');
    }

    await visibleButton.click();
  }

  async submitPasswordStep() {
    const signInButton = await this.getFirstVisible(this.signInButton);
    const canUseSignIn = signInButton !== null;

    if (canUseSignIn) {
      await signInButton.click();

      return;
    }

    const continueButton = await this.getFirstVisible(this.continueButton);
    const canUseContinue = continueButton !== null;

    if (canUseContinue) {
      await continueButton.click();

      return;
    }

    // Some auth UI variants only submit on Enter from the password input.
    await this.passwordField.first().press('Enter');
  }

  async clickSignUpButton() {
    await this.signUpButton.click();
  }

  async clickForgotPassword() {
    await this.forgotPasswordButton.click();
  }

  async revealPassword() {
    await this.revealPasswordButton.click();
  }

  async previewImage() {
    await this.previewImageButton.click();
  }

  async clickUploadImage() {
    await this.uploadImageButton.click();
  }

  async deleteImage() {
    await this.deleteImageButton.click();
  }

  async typeWorkspaceName(workspaceName: string) {
    await this.workspaceNameField.fill(workspaceName);
  }

  async typeFirstName(firstName: string) {
    await this.firstNameField.fill(firstName);
  }

  async typeLastName(lastName: string) {
    await this.lastNameField.fill(lastName);
  }

  async clickSyncEverythingWithGoogleRadio() {
    await this.syncEverythingWithGoogleRadio.click();
  }

  async clickSyncSubjectAndMetadataWithGoogleRadio() {
    await this.syncSubjectAndMetadataWithGoogleRadio.click();
  }

  async clickSyncMetadataWithGoogleRadio() {
    await this.syncMetadataWithGoogleRadio.click();
  }

  async clickSyncWithGoogleButton() {
    await this.syncWithGoogleButton.click();
  }

  async noSyncWithGoogle() {
    await this.noSyncButton.click();
  }

  async typeInviteLink1(email: string) {
    await this.inviteLinkField1.fill(email);
  }

  async typeInviteLink2(email: string) {
    await this.inviteLinkField2.fill(email);
  }

  async typeInviteLink3(email: string) {
    await this.inviteLinkField3.fill(email);
  }

  async clickCopyInviteLink() {
    await this.copyInviteLink.click();
  }

  async clickFinishButton() {
    await this.finishButton.click();
  }
}

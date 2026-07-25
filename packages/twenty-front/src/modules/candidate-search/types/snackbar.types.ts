export type SnackBarEnqueueFunctions = {
  enqueueSuccessSnackBar: (params: { message: string }) => void;
  enqueueErrorSnackBar: (params: { message: string }) => void;
  enqueueInfoSnackBar: (params: { message: string }) => void;
  enqueueWarningSnackBar: (params: { message: string }) => void;
};

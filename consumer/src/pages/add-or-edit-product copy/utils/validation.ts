// Simple validation utility for State components
export const getValidationStatus = (field: string, validationState: any) => {
  const validation = validationState[field] || { status: '', help: '' };
  
  // Return empty validation if the field has no error
  if (!validation.status || validation.status === '') {
    return { status: '', help: '' };
  }
  
  return validation;
};

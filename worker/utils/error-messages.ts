/**
 * User-friendly error messages
 */

export interface UserFriendlyError {
  title: string;
  message: string;
  action?: string;
}

/**
 * Convert technical errors to user-friendly messages
 */
export function getUserFriendlyError(error: unknown): UserFriendlyError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorLower = errorMessage.toLowerCase();

  // Radar API errors
  if (errorLower.includes('radar api')) {
    if (errorLower.includes('401') || errorLower.includes('unauthorized')) {
      return {
        title: 'Authentication Error',
        message: 'Unable to connect to the scanning service. Please try again later.',
        action: 'If this persists, contact support.'
      };
    }
    
    if (errorLower.includes('429') || errorLower.includes('rate limit')) {
      return {
        title: 'Too Many Requests',
        message: 'We\'re receiving a high volume of scan requests right now.',
        action: 'Please wait a few minutes and try again.'
      };
    }
    
    if (errorLower.includes('400') || errorLower.includes('bad request')) {
      return {
        title: 'Invalid URL',
        message: 'The URL you provided couldn\'t be scanned.',
        action: 'Please check the URL and try again.'
      };
    }
    
    if (errorLower.includes('timeout')) {
      return {
        title: 'Scan Timeout',
        message: 'The scan took longer than expected to complete.',
        action: 'Please try scanning this URL again.'
      };
    }
    
    return {
      title: 'Scanning Service Error',
      message: 'We encountered an issue while scanning your URL.',
      action: 'Please try again in a few moments.'
    };
  }

  // Network errors
  if (errorLower.includes('network') || errorLower.includes('fetch')) {
    return {
      title: 'Connection Error',
      message: 'Unable to connect to our servers.',
      action: 'Please check your internet connection and try again.'
    };
  }

  // Timeout errors
  if (errorLower.includes('timeout')) {
    return {
      title: 'Request Timeout',
      message: 'The request took too long to complete.',
      action: 'Please try again.'
    };
  }

  // R2 storage errors
  if (errorLower.includes('r2') || errorLower.includes('storage')) {
    return {
      title: 'Storage Error',
      message: 'We couldn\'t save your scan report.',
      action: 'Please try scanning again.'
    };
  }

  // Database errors
  if (errorLower.includes('database') || errorLower.includes('d1')) {
    return {
      title: 'Database Error',
      message: 'We encountered an issue saving your scan data.',
      action: 'Your scan may still complete. Please check back in a moment.'
    };
  }

  // PDF generation errors
  if (errorLower.includes('pdf')) {
    return {
      title: 'Report Generation Error',
      message: 'We couldn\'t generate your PDF report.',
      action: 'Please try scanning again.'
    };
  }

  // Workflow errors
  if (errorLower.includes('workflow')) {
    return {
      title: 'Processing Error',
      message: 'We encountered an issue processing your scan.',
      action: 'Please try again.'
    };
  }

  // Email errors
  if (errorLower.includes('email') || errorLower.includes('resend')) {
    return {
      title: 'Email Delivery Failed',
      message: 'We couldn\'t send the report to your email.',
      action: 'You can still download the report from this page.'
    };
  }

  // Generic error
  return {
    title: 'Something Went Wrong',
    message: 'We encountered an unexpected error.',
    action: 'Please try again. If the problem persists, contact support.'
  };
}

/**
 * Format error for logging (includes technical details)
 */
export function formatErrorForLogging(error: unknown, context?: string): string {
  const prefix = context ? `[${context}]` : '';
  
  if (error instanceof Error) {
    return `${prefix} ${error.name}: ${error.message}\n${error.stack || ''}`;
  }
  
  return `${prefix} ${String(error)}`;
}

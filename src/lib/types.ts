export type ThuleDownloadRecord = {
    id?: number;
    created_at?: string;
    file_name: string;
    file_type: 'product' | 'car';
    file_size: number;
    status: 'success' | 'error';
    error_message?: string;
}; 
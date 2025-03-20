import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { TecDocService, type AssemblyGroupNode } from '$lib/services/TecDocService';

interface AssemblyGroupWithSubGroups extends AssemblyGroupNode {
    subGroups: AssemblyGroupWithSubGroups[];
}

export const GET: RequestHandler = async ({ url }) => {
    try {
        const vehicleId = parseInt(url.searchParams.get('vehicleId') || '');
        
        if (!vehicleId) {
            return json({
                success: false,
                error: 'Vehicle ID is required'
            }, { status: 400 });
        }

        const tecDocService = new TecDocService();
        const assemblyGroups = await tecDocService.getAssemblyGroups(vehicleId);

        // Create a hierarchical structure for easier navigation
        const groupsMap = new Map<number, AssemblyGroupWithSubGroups>();
        const rootGroups: AssemblyGroupWithSubGroups[] = [];

        // First pass: create map of all groups
        assemblyGroups.forEach(group => {
            groupsMap.set(group.assemblyGroupNodeId, {
                ...group,
                subGroups: []
            });
        });

        // Second pass: build hierarchy
        assemblyGroups.forEach(group => {
            const mappedGroup = groupsMap.get(group.assemblyGroupNodeId);
            
            if (mappedGroup && group.parentNodeId && groupsMap.has(group.parentNodeId)) {
                const parent = groupsMap.get(group.parentNodeId);
                if (parent) {
                    parent.subGroups.push(mappedGroup);
                }
            } else if (mappedGroup) {
                rootGroups.push(mappedGroup);
            }
        });

        return json({
            success: true,
            assemblyGroups: rootGroups
        });

    } catch (error) {
        console.error('TecDoc assembly groups lookup error:', error);
        return json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to process request',
            debug: error instanceof Error ? {
                message: error.message,
                stack: error.stack
            } : error
        }, { status: 500 });
    }
}; 
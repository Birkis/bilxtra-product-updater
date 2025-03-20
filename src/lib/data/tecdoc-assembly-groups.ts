/**
 * TecDoc Assembly Groups
 * 
 * This file contains the assembly groups fetched from the TecDoc API for vehicle ID 138779 (AUDI E-TRON).
 * These groups can be used to filter parts in the TecDoc parts search.
 */

export interface AssemblyGroup {
    id: number;
    name: string;
    parentId?: number;
    hasChildren?: boolean;
    description?: string;
}

/**
 * Top-level assembly groups (those with children)
 */
export const parentAssemblyGroups: AssemblyGroup[] = [
    // Main brake system group
    { id: 100006, name: "Bremseanlegg", hasChildren: true },
    
    // Brake subgroups
    { id: 100027, name: "Bremsecaliper", hasChildren: true, parentId: 100006 },
    { id: 102224, name: "høyytelse bremse", hasChildren: true, parentId: 100006 },
    { id: 100626, name: "Skivebremse", hasChildren: true, parentId: 100006 },
    { id: 100627, name: "Trommelbremse", hasChildren: true, parentId: 100006 },
    
    // Other main groups
    { id: 100400, name: "Akseldrift", hasChildren: true },
    { id: 100043, name: "Belysning", hasChildren: true },
    { id: 100100, name: "Engine", hasChildren: true },
    { id: 100200, name: "Suspension", hasChildren: true },
    { id: 100300, name: "Electrical System", hasChildren: true },
];

/**
 * Brake-related assembly groups
 */
export const brakeAssemblyGroups: AssemblyGroup[] = [
    // Main brake system group
    { id: 100006, name: "Bremseanlegg", hasChildren: true },
    
    // Brake calipers
    { id: 100027, name: "Bremsecaliper", hasChildren: true, parentId: 100006 },
    { id: 100807, name: "Bremsecaliper / -holder (bærer)", parentId: 100027, hasChildren: false },
    
    // Brake components
    { id: 100025, name: "Bremseforsterker", parentId: 100006, hasChildren: false },
    { id: 100037, name: "Bremsekraft regulator", parentId: 100006, hasChildren: false },
    { id: 102248, name: "Bremselysbryter", parentId: 100006, hasChildren: false },
    { id: 100035, name: "Bremseslanger", parentId: 100006, hasChildren: false },
    { id: 102208, name: "Bremsevæske", parentId: 100006, hasChildren: false },
    { id: 100029, name: "Bremsevæske / -tank", parentId: 100006, hasChildren: false },
    { id: 100026, name: "Hovedbremsesylinder", parentId: 100006, hasChildren: false },
    { id: 100034, name: "Parkeringsbrems", parentId: 100006, hasChildren: false },
    
    // Disc brakes
    { id: 100626, name: "Skivebremse", hasChildren: true, parentId: 100006 },
    { id: 100030, name: "Bremsebelegg", parentId: 100626, hasChildren: false },
    { id: 102244, name: "bremsesett", parentId: 100626, hasChildren: false },
    { id: 100032, name: "Bremseskive", parentId: 100626, hasChildren: false },
    
    // Drum brakes
    { id: 100627, name: "Trommelbremse", hasChildren: true, parentId: 100006 },
    { id: 100031, name: "Bremsebelegg / -sko", parentId: 100627, hasChildren: false },
    { id: 102763, name: "bremsesett", parentId: 100627, hasChildren: false },
    { id: 100033, name: "Bremsetrommel", parentId: 100627, hasChildren: false },
];

/**
 * Comparison with hardcoded assembly groups
 * 
 * The hardcoded brake assembly groups in the frontend were:
 * [100463, 100464, 100465, 100466, 100467, 100468, 100469]
 * 
 * These IDs do not match the actual TecDoc assembly groups for brakes, which are:
 * - Main brake system: 100006
 * - Brake calipers: 100027, 100807
 * - Disc brakes: 100626, 100030, 100032
 * - Drum brakes: 100627, 100031, 100033
 * - Brake fluid: 102208
 */

/**
 * Special "All Parts" group and other common groups
 */
export const commonAssemblyGroups: AssemblyGroup[] = [
    // Special "All Parts" group
    { id: 100002, name: "All Parts", description: "All compatible parts for the vehicle" },
    
    // Brake System
    { id: 100006, name: "Bremseanlegg", description: "Complete brake system components", hasChildren: true },
    { id: 100032, name: "Bremseskive", description: "Brake rotors/discs", parentId: 100626, hasChildren: false },
    { id: 100030, name: "Bremsebelegg", description: "Brake pads", parentId: 100626, hasChildren: false },
    { id: 100027, name: "Bremsecaliper", description: "Brake calipers", parentId: 100006, hasChildren: true },
    { id: 100033, name: "Bremsetrommel", description: "Brake drums", parentId: 100627, hasChildren: false },
    { id: 100031, name: "Bremsebelegg / -sko", description: "Brake shoes", parentId: 100627, hasChildren: false },
    { id: 102208, name: "Bremsevæske", description: "Brake fluid", parentId: 100006, hasChildren: false },
    
    // Engine
    { id: 100100, name: "Engine", description: "Engine components and parts", hasChildren: true },
    
    // Suspension
    { id: 100200, name: "Suspension", description: "Suspension system components", hasChildren: true },
    
    // Electrical
    { id: 100300, name: "Electrical System", description: "Electrical system components", hasChildren: true },
    
    // Lighting
    { id: 100043, name: "Belysning", description: "Vehicle lighting components", hasChildren: true },
]; 
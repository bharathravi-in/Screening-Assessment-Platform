export interface Technology {
  id: string;
  name: string;
  category: string;
  icon_url: string | null;
  is_active: boolean;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
  skills?: Skill[];
}

export interface Skill {
  id: string;
  technology_id: string;
  name: string;
  description: string | null;
  difficulty_default: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

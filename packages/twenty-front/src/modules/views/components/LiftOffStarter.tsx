import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
// // import { NavigationDrawerItem } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItem';
// // import { NavigationDrawerSection } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSection';
// // import { NavigationDrawerSectionTitle } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSectionTitle';
// import { navigationMemorizedUrlState } from '@/ui/navigation/states/navigationMemorizedUrlState';
// import { useSetRecoilState } from 'recoil';

// const setNavigationMemorizedUrl = useSetRecoilState( navigationMemorizedUrlState );


// // export const LiftOffStarter: React.FC = () => "null";


// const location = useLocation();
// const navigate = useNavigate(); 
export const LiftOffStarter: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    return (
        <div style={{ cursor: "pointer" }} onClick={() => {
            navigate('/video-interview');
        }}>
            Video Interview
        </div>
    );
};

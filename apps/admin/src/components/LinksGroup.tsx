import { useState } from 'react';
import { Box, Text, UnstyledButton } from '@mantine/core';
import { ChevronRight } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface LinksGroupProps {
  icon: React.FC<{ size?: number; color?: string }>;
  label: string;
  to?: string;
  initiallyOpened?: boolean;
  links?: { label: string; link: string }[];
}

export function LinksGroup({ icon: Icon, label, to, initiallyOpened, links }: LinksGroupProps) {
  const hasLinks = Array.isArray(links) && links.length > 0;
  const [opened, setOpened] = useState(initiallyOpened ?? false);
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = to ? (to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)) : false;
  const isChildActive = links?.some((l) => location.pathname === l.link) ?? false;

  const handleClick = () => {
    if (hasLinks) {
      setOpened((o) => !o);
    } else if (to) {
      navigate(to);
    }
  };

  const items = (hasLinks ? links : []).map((link) => (
    <Text
      component="a"
      key={link.label}
      onClick={(e: React.MouseEvent) => { e.preventDefault(); navigate(link.link); }}
      href={link.link}
      style={{
        display: 'block',
        padding: '8px 12px 8px 40px',
        fontSize: 13,
        color: location.pathname === link.link ? 'var(--mantine-color-blue-4)' : '#888',
        textDecoration: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        background: location.pathname === link.link ? 'rgba(74,144,217,0.1)' : 'transparent',
      }}
    >
      {link.label}
    </Text>
  ));

  return (
    <>
      <UnstyledButton
        onClick={handleClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          padding: '10px 12px',
          borderRadius: 8,
          color: isActive || isChildActive ? '#fff' : '#999',
          background: isActive || isChildActive ? 'rgba(74,144,217,0.2)' : 'transparent',
          fontSize: 13,
          fontWeight: isActive || isChildActive ? 600 : 400,
          cursor: 'pointer',
        }}
      >
        <Icon size={20} color={isActive || isChildActive ? '#4A90D9' : '#777'} />
        <Box ml="sm" style={{ flex: 1 }}>{label}</Box>
        {hasLinks && (
          <ChevronRight
            size={14}
            color="#666"
            style={{
              transition: 'transform 200ms ease',
              transform: opened ? 'rotate(90deg)' : 'none',
            }}
          />
        )}
      </UnstyledButton>
      {hasLinks && opened && <div>{items}</div>}
    </>
  );
}

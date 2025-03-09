import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { addDays } from 'date-fns';
import React from 'react';
import { Calendar } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { Button, IconMinus, MenuItemSelect } from 'twenty-ui';
import { FormComponentProps } from '../types/FormComponentProps';
import {
  StyledLabel,
  StyledSection,
  StyledSectionContent,
  StyledSectionHeader,
} from './ArxJDUploadModal.styled';

const StyledDateSlotContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-top: ${({ theme }) => theme.spacing(2)};
`;

const StyledDateSlot = styled.div`
  align-items: center;
  background-color: ${({ theme }) => theme.background.secondary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)};
`;

const StyledCalendarContainer = styled.div`
  .rdrCalendarWrapper {
    background-color: ${({ theme }) => theme.background.primary};
    border: 1px solid ${({ theme }) => theme.border.color.medium};
    border-radius: ${({ theme }) => theme.border.radius.md};
  }
`;

export const MeetingSchedulingSection: React.FC<FormComponentProps> = ({
  parsedJD,
  setParsedJD,
}) => {
  const theme = useTheme();

  // Prevent hotkey propagation when interacting with calendar
  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  const handleDateSelect = (date: Date) => {
    const dateStr = date.toISOString();
    const existingDateIndex =
      parsedJD.meetingScheduling.availableDates.findIndex(
        (d: { date: string }) => d.date.split('T')[0] === dateStr.split('T')[0],
      );

    if (existingDateIndex === -1) {
      setParsedJD({
        ...parsedJD,
        meetingScheduling: {
          ...parsedJD.meetingScheduling,
          availableDates: [
            ...parsedJD.meetingScheduling.availableDates,
            {
              date: dateStr,
              timeSlots: {
                morning: false,
                afternoon: false,
                evening: false,
              },
            },
          ],
        },
      });
    } else {
      setParsedJD({
        ...parsedJD,
        meetingScheduling: {
          ...parsedJD.meetingScheduling,
          availableDates: parsedJD.meetingScheduling.availableDates.filter(
            (_: unknown, index: number) => index !== existingDateIndex,
          ),
        },
      });
    }
  };

  const toggleTimeSlot = (
    dateIndex: number,
    slot: 'morning' | 'afternoon' | 'evening',
  ) => {
    setParsedJD({
      ...parsedJD,
      meetingScheduling: {
        ...parsedJD.meetingScheduling,
        availableDates: parsedJD.meetingScheduling.availableDates.map(
          (date, index) =>
            index === dateIndex
              ? {
                  ...date,
                  timeSlots: {
                    ...date.timeSlots,
                    [slot]: !date.timeSlots[slot],
                  },
                }
              : date,
        ),
      },
    });
  };

  return (
    <StyledSection>
      <StyledSectionHeader>Meeting Scheduling</StyledSectionHeader>
      <StyledSectionContent>
        <StyledLabel>Meeting Type</StyledLabel>
        <MenuItemSelect
          selected={parsedJD.meetingScheduling.meetingType === 'walkIn'}
          onClick={() => {
            setParsedJD({
              ...parsedJD,
              meetingScheduling: {
                ...parsedJD.meetingScheduling,
                meetingType: 'walkIn',
              },
            });
          }}
          text="Walk-in"
        />
        <MenuItemSelect
          selected={parsedJD.meetingScheduling.meetingType === 'online'}
          onClick={() => {
            setParsedJD({
              ...parsedJD,
              meetingScheduling: {
                ...parsedJD.meetingScheduling,
                meetingType: 'online',
              },
            });
          }}
          text="Online"
        />
        <MenuItemSelect
          selected={parsedJD.meetingScheduling.meetingType === 'inPerson'}
          onClick={() => {
            setParsedJD({
              ...parsedJD,
              meetingScheduling: {
                ...parsedJD.meetingScheduling,
                meetingType: 'inPerson',
              },
            });
          }}
          text="In Person"
        />

        {(parsedJD.meetingScheduling.meetingType === 'online' ||
          parsedJD.meetingScheduling.meetingType === 'inPerson') && (
          <>
            <StyledLabel style={{ marginTop: theme.spacing(4) }}>
              Select Available Dates & Time Slots
            </StyledLabel>
            <div
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              onKeyDown={handleKeyDown}
            >
              <StyledCalendarContainer>
                <Calendar
                  date={new Date()}
                  onChange={handleDateSelect}
                  minDate={new Date()}
                  maxDate={addDays(new Date(), 90)}
                  dateDisplayFormat="yyyy-MM-dd"
                  color={theme.color.blue}
                />
              </StyledCalendarContainer>

              <StyledDateSlotContainer>
                {parsedJD.meetingScheduling.availableDates.map(
                  (date, index) => (
                    <StyledDateSlot key={date.date}>
                      <span>{new Date(date.date).toLocaleDateString()}</span>
                      <MenuItemSelect
                        selected={date.timeSlots.morning}
                        onClick={() => toggleTimeSlot(index, 'morning')}
                        text="Morning (9 AM - 12 PM)"
                      />
                      <MenuItemSelect
                        selected={date.timeSlots.afternoon}
                        onClick={() => toggleTimeSlot(index, 'afternoon')}
                        text="Afternoon (12 PM - 5 PM)"
                      />
                      <MenuItemSelect
                        selected={date.timeSlots.evening}
                        onClick={() => toggleTimeSlot(index, 'evening')}
                        text="Evening (5 PM - 8 PM)"
                      />
                      <Button
                        variant="secondary"
                        title="Remove"
                        Icon={IconMinus}
                        onClick={() =>
                          setParsedJD({
                            ...parsedJD,
                            meetingScheduling: {
                              ...parsedJD.meetingScheduling,
                              availableDates:
                                parsedJD.meetingScheduling.availableDates.filter(
                                  (_, i) => i !== index,
                                ),
                            },
                          })
                        }
                      />
                    </StyledDateSlot>
                  ),
                )}
              </StyledDateSlotContainer>
            </div>
          </>
        )}
      </StyledSectionContent>
    </StyledSection>
  );
};

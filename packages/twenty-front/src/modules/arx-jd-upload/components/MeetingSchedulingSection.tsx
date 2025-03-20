import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { addDays } from 'date-fns';
import { enUS } from 'date-fns/locale';
import React from 'react';
import { Calendar } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { Button, IconMinus, MenuItemSelect, Radio } from 'twenty-ui';
import { FormComponentProps } from '../types/FormComponentProps';
import { StyledSection, StyledSectionContent } from './ArxJDUploadModal.styled';

const StyledLabel = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  text-align: center;
  width: 100%;
`;

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
  display: flex;
  justify-content: center;
  margin: ${({ theme }) => theme.spacing(2)} 0;

  .rdrCalendarWrapper {
    background-color: ${({ theme }) => theme.background.primary};
    border: 1px solid ${({ theme }) => theme.border.color.medium};
    border-radius: ${({ theme }) => theme.border.radius.md};
  }
`;

const StyledFlexContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

const StyledMeetingTypeContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(4)};
`;

const StyledRadioOption = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
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

  const handleMeetingTypeChange = (type: 'walkIn' | 'online' | 'inPerson') => {
    setParsedJD({
      ...parsedJD,
      meetingScheduling: {
        ...parsedJD.meetingScheduling,
        meetingType: type,
      },
    });
  };

  return (
    <StyledSection>
      <StyledSectionContent>
        <StyledFlexContainer>
          <StyledMeetingTypeContainer>
            <StyledLabel>Meeting Type</StyledLabel>
            <StyledRadioOption>
              <Radio
                checked={parsedJD.meetingScheduling.meetingType === 'walkIn'}
                onChange={() => handleMeetingTypeChange('walkIn')}
              />
              <span>Walk-in</span>
            </StyledRadioOption>
            <StyledRadioOption>
              <Radio
                checked={parsedJD.meetingScheduling.meetingType === 'online'}
                onChange={() => handleMeetingTypeChange('online')}
              />
              <span>Online</span>
            </StyledRadioOption>
            <StyledRadioOption>
              <Radio
                checked={parsedJD.meetingScheduling.meetingType === 'inPerson'}
                onChange={() => handleMeetingTypeChange('inPerson')}
              />
              <span>In Person</span>
            </StyledRadioOption>
          </StyledMeetingTypeContainer>

          {(parsedJD.meetingScheduling.meetingType === 'online' ||
            parsedJD.meetingScheduling.meetingType === 'inPerson') && (
            <>
              <StyledLabel style={{ marginTop: theme.spacing(0) }}>
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
                    locale={enUS}
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
        </StyledFlexContainer>
      </StyledSectionContent>
    </StyledSection>
  );
};
